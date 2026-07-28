import asyncio
import math
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from ..database import async_session
from ..models import StockFundamentals
from .nifty_index import load_nifty_universe

IST = timezone(timedelta(hours=5, minutes=30))

MAX_RETRIES = 2
DELAY_BETWEEN_CALLS = 2.0
STALE_HOURS = 24

_fetch_lock = asyncio.Lock()
_fetch_status: dict = {
    "running": False,
    "progress": 0,
    "total": 0,
    "errors": 0,
    "last_run": None,
    "last_error": None,
}


def _sanitize(val: float | None) -> float | None:
    if val is None:
        return None
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return None
        return round(f, 4)
    except (TypeError, ValueError):
        return None


def _fetch_single_ticker(ticker: str) -> dict | None:
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
    }


async def fetch_fundamentals_for_ticker(ticker: str) -> dict | None:
    for attempt in range(MAX_RETRIES + 1):
        try:
            result = await asyncio.to_thread(_fetch_single_ticker, ticker)
            return result
        except Exception as e:
            if attempt < MAX_RETRIES:
                await asyncio.sleep(DELAY_BETWEEN_CALLS)
            else:
                print(f"[Fundamentals] Failed {ticker} after {MAX_RETRIES + 1} attempts: {e}")
                return None


async def refresh_all_fundamentals() -> dict:
    if _fetch_lock.locked():
        return {"status": "already_running"}

    async with _fetch_lock:
        _fetch_status["running"] = True
        _fetch_status["progress"] = 0
        _fetch_status["errors"] = 0
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

        success_rate = fetched / len(universe) if universe else 0
        print(f"[Fundamentals] Completed: {fetched}/{len(universe)} fetched ({success_rate:.0%}), {errors} errors")
        return {"status": "ok", "fetched": fetched, "errors": errors, "total": len(universe)}


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

        if hours_since < STALE_HOURS:
            freshness = "fresh"
        elif hours_since < STALE_HOURS * 3:
            freshness = "stale"
        else:
            freshness = "very_stale"

        return {
            "count": len(rows),
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
