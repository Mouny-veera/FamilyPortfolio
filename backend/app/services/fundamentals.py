import asyncio
import math
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from ..database import async_session
from ..models import StockFundamentals
from .nifty_index import load_nifty_universe

IST = timezone(timedelta(hours=5, minutes=30))

MAX_RETRIES = 2
DELAY_BETWEEN_CALLS = 0.5
STALE_HOURS = 24

_fetch_lock = asyncio.Lock()
_fetch_status: dict = {
    "running": False,
    "progress": 0,
    "total": 0,
    "errors": 0,
    "bse_hits": 0,
    "yf_fallbacks": 0,
    "last_run": None,
    "last_error": None,
}

_bse_scrip_cache: dict[str, str] = {}


def _sanitize(val) -> float | None:
    if val is None or val == "-" or val == "":
        return None
    try:
        f = float(str(val).replace(",", ""))
        if math.isnan(f) or math.isinf(f) or f == 0.0:
            return None
        return round(f, 4)
    except (TypeError, ValueError):
        return None


def _sanitize_str(val) -> str | None:
    if val is None or val == "-" or val == "":
        return None
    return str(val).strip()


def _compute_peg(pe: float | None, eps_current: float | None, eps_previous: float | None) -> float | None:
    if pe is None or eps_current is None or eps_previous is None:
        return None
    if eps_previous <= 0:
        return None
    growth_rate = ((eps_current - eps_previous) / abs(eps_previous)) * 100
    if growth_rate <= 0:
        return None
    peg = pe / growth_rate
    return round(peg, 4)


def _fetch_bse_single(ticker: str) -> dict | None:
    from bse import BSE

    b = BSE(download_folder="/tmp/bse_data")
    try:
        if ticker in _bse_scrip_cache:
            code = _bse_scrip_cache[ticker]
        else:
            try:
                code = b.getScripCode(ticker)
            except (ValueError, KeyError):
                return None
            if not code:
                return None
            _bse_scrip_cache[ticker] = code

        meta = b.equityMetaInfo(code)
        if not meta:
            return None

        con_pe = _sanitize(meta.get("ConPE"))
        standalone_pe = _sanitize(meta.get("PE"))
        pe = con_pe or standalone_pe

        con_eps = _sanitize(meta.get("ConEPS"))
        standalone_eps = _sanitize(meta.get("EPS"))
        eps = con_eps or standalone_eps

        eps_previous = None
        peg = None
        try:
            results = b.resultsSnapshot(code)
            if results and "results_in_crores" in results:
                data_rows = results["results_in_crores"].get("data", [])
                for row in data_rows:
                    if row and row[0] == "EPS" and len(row) >= 3:
                        fy_eps = _sanitize(row[-1])
                        prev_q_eps = _sanitize(row[-2]) if len(row) > 3 else None
                        if fy_eps and eps:
                            eps_previous = fy_eps
                            if eps != fy_eps:
                                peg = _compute_peg(pe, eps, fy_eps)
                        break
        except Exception:
            pass

        market_cap = None
        try:
            stats = b.getScripTradingStats(code)
            if stats:
                mc_str = stats.get("MktCapFull", "")
                market_cap = _sanitize(mc_str)
                if market_cap:
                    market_cap = round(market_cap * 1e7, 0)
        except Exception:
            pass

        earnings_growth = None
        if eps and eps_previous and eps_previous > 0:
            earnings_growth = round(((eps - eps_previous) / abs(eps_previous)), 4)

        return {
            "ticker": ticker,
            "pe_ratio": pe,
            "peg_ratio": peg,
            "eps": eps,
            "earnings_growth": earnings_growth,
            "market_cap": market_cap,
            "sector": _sanitize_str(meta.get("Sector")),
            "industry": _sanitize_str(meta.get("IndustryNew")),
            "pb_ratio": _sanitize(meta.get("ConPB")) or _sanitize(meta.get("PB")),
            "roe": _sanitize(meta.get("ConROE")) or _sanitize(meta.get("ROE")),
            "npm": _sanitize(meta.get("ConNPM")) or _sanitize(meta.get("NPM")),
            "face_value": _sanitize(meta.get("FaceVal")),
            "data_source": "bse",
            "bse_scrip_code": str(code),
        }
    except Exception as e:
        raise
    finally:
        b.exit()


def _fetch_yfinance_single(ticker: str) -> dict | None:
    import yfinance as yf
    t = yf.Ticker(f"{ticker}.NS")
    info = t.info
    if not info or info.get("regularMarketPrice") is None:
        return None
    return {
        "ticker": ticker,
        "pe_ratio": _sanitize(info.get("trailingPE")),
        "peg_ratio": _sanitize(info.get("pegRatio")),
        "eps": _sanitize(info.get("trailingEps")),
        "earnings_growth": _sanitize(info.get("earningsGrowth")),
        "market_cap": _sanitize(info.get("marketCap")),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "pb_ratio": _sanitize(info.get("priceToBook")),
        "roe": _sanitize(info.get("returnOnEquity")),
        "npm": _sanitize(info.get("profitMargins")),
        "face_value": None,
        "data_source": "yfinance",
        "bse_scrip_code": None,
    }


async def fetch_fundamentals_for_ticker(ticker: str) -> dict | None:
    for attempt in range(MAX_RETRIES + 1):
        try:
            result = await asyncio.to_thread(_fetch_bse_single, ticker)
            if result and result.get("pe_ratio") is not None:
                _fetch_status["bse_hits"] = _fetch_status.get("bse_hits", 0) + 1
                return result
            break
        except Exception:
            if attempt < MAX_RETRIES:
                await asyncio.sleep(DELAY_BETWEEN_CALLS)
            else:
                break

    try:
        result = await asyncio.to_thread(_fetch_yfinance_single, ticker)
        if result:
            _fetch_status["yf_fallbacks"] = _fetch_status.get("yf_fallbacks", 0) + 1
            return result
    except Exception as e:
        print(f"[Fundamentals] Both BSE and yfinance failed for {ticker}: {e}")

    return None


async def refresh_all_fundamentals() -> dict:
    if _fetch_lock.locked():
        return {"status": "already_running"}

    async with _fetch_lock:
        _fetch_status["running"] = True
        _fetch_status["progress"] = 0
        _fetch_status["errors"] = 0
        _fetch_status["bse_hits"] = 0
        _fetch_status["yf_fallbacks"] = 0
        _fetch_status["last_error"] = None

        universe = load_nifty_universe()
        if not universe:
            _fetch_status["running"] = False
            return {"status": "error", "message": "No universe loaded"}

        _fetch_status["total"] = len(universe)
        fetched = 0
        errors = 0

        for i, ticker in enumerate(universe):
            _fetch_status["progress"] = i + 1
            try:
                data = await fetch_fundamentals_for_ticker(ticker)
                if data:
                    async with async_session() as db:
                        existing = await db.get(StockFundamentals, ticker)
                        if existing:
                            for k, v in data.items():
                                if k != "ticker":
                                    setattr(existing, k, v)
                            existing.updated_at = datetime.now(timezone.utc)
                        else:
                            db.add(StockFundamentals(
                                **data,
                                updated_at=datetime.now(timezone.utc),
                            ))
                        await db.commit()
                    fetched += 1
                else:
                    errors += 1
            except Exception as e:
                errors += 1
                _fetch_status["last_error"] = f"{ticker}: {e}"
                print(f"[Fundamentals] Error saving {ticker}: {e}")

            await asyncio.sleep(DELAY_BETWEEN_CALLS)

        _fetch_status["running"] = False
        _fetch_status["errors"] = errors
        _fetch_status["last_run"] = datetime.now(IST).isoformat()

        bse_hits = _fetch_status["bse_hits"]
        yf_fb = _fetch_status["yf_fallbacks"]
        print(f"[Fundamentals] Completed: {fetched}/{len(universe)} fetched "
              f"(BSE: {bse_hits}, yfinance fallback: {yf_fb}), {errors} errors")
        return {
            "status": "ok", "fetched": fetched, "errors": errors,
            "total": len(universe), "bse_hits": bse_hits, "yf_fallbacks": yf_fb,
        }


async def get_all_fundamentals() -> dict[str, dict]:
    async with async_session() as db:
        result = await db.execute(select(StockFundamentals))
        rows = result.scalars().all()
        return {
            row.ticker: {
                "pe_ratio": row.pe_ratio,
                "peg_ratio": row.peg_ratio,
                "eps": row.eps,
                "market_cap": row.market_cap,
                "sector": row.sector,
                "industry": row.industry,
                "pb_ratio": row.pb_ratio,
                "roe": row.roe,
                "data_source": row.data_source,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            }
            for row in rows
        }


async def get_fundamentals_status() -> dict:
    async with async_session() as db:
        result = await db.execute(select(StockFundamentals))
        rows = result.scalars().all()
        if not rows:
            return {"count": 0, "freshness": "no_data", **_fetch_status}

        oldest = min(r.updated_at for r in rows if r.updated_at)
        newest = max(r.updated_at for r in rows if r.updated_at)
        now = datetime.now(timezone.utc)
        hours_since = (now - newest).total_seconds() / 3600

        bse_count = sum(1 for r in rows if r.data_source == "bse")
        yf_count = sum(1 for r in rows if r.data_source == "yfinance")

        if hours_since < STALE_HOURS:
            freshness = "fresh"
        elif hours_since < STALE_HOURS * 3:
            freshness = "stale"
        else:
            freshness = "very_stale"

        return {
            "count": len(rows),
            "bse_sourced": bse_count,
            "yfinance_sourced": yf_count,
            "oldest_update": oldest.isoformat(),
            "newest_update": newest.isoformat(),
            "hours_since_update": round(hours_since, 1),
            "freshness": freshness,
            **_fetch_status,
        }


async def is_data_stale() -> bool:
    async with async_session() as db:
        result = await db.execute(select(StockFundamentals))
        rows = result.scalars().all()
        if not rows or len(rows) < 100:
            return True
        newest = max(r.updated_at for r in rows if r.updated_at)
        hours_since = (datetime.now(timezone.utc) - newest).total_seconds() / 3600
        return hours_since > STALE_HOURS
