import csv
import io
import threading
from difflib import SequenceMatcher
from datetime import datetime, timezone
from dataclasses import dataclass

import httpx
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import async_session
from ..models import NseStock, Lot


FYERS_SYMBOLS_URL = "https://public.fyers.in/sym_details/NSE_CM.csv"


@dataclass(frozen=True, slots=True)
class _CachedStock:
    symbol: str
    company_name: str
    isin: str
    symbol_upper: str
    name_upper: str
    name_tokens: frozenset


class _StockCache:
    def __init__(self):
        self._stocks: list[_CachedStock] = []
        self._symbol_set: set[str] = set()
        self._lock = threading.Lock()

    def load(self, stocks: list[dict]):
        items = []
        symbols = set()
        for s in stocks:
            sym = s["symbol"]
            name = s["company_name"]
            name_upper = name.upper()
            items.append(_CachedStock(
                symbol=sym,
                company_name=name,
                isin=s.get("isin", ""),
                symbol_upper=sym.upper(),
                name_upper=name_upper,
                name_tokens=frozenset(name_upper.replace("-", " ").replace(".", " ").split()),
            ))
            symbols.add(sym)
        with self._lock:
            self._stocks = items
            self._symbol_set = symbols

    @property
    def loaded(self) -> bool:
        return len(self._stocks) > 0

    def has_symbol(self, symbol: str) -> bool:
        return symbol in self._symbol_set

    @property
    def symbol_set(self) -> frozenset[str]:
        return frozenset(self._symbol_set)

    def search(self, query: str, limit: int = 10) -> list[dict]:
        q = query.upper().strip()
        if not q:
            return []

        exact = []
        prefix = []
        contains_sym = []
        contains_name = []

        for s in self._stocks:
            if s.symbol_upper == q:
                exact.append(s)
            elif s.symbol_upper.startswith(q):
                prefix.append(s)
            elif q in s.symbol_upper:
                contains_sym.append(s)
            elif q in s.name_upper:
                contains_name.append(s)

        prefix.sort(key=lambda s: s.symbol_upper)
        contains_sym.sort(key=lambda s: s.symbol_upper)
        contains_name.sort(key=lambda s: s.symbol_upper)

        results = exact + prefix + contains_sym + contains_name
        return [
            {"symbol": s.symbol, "company_name": s.company_name, "isin": s.isin}
            for s in results[:limit]
        ]

    def fuzzy_match(self, ticker: str, top_n: int = 5) -> list[dict]:
        q = ticker.upper().strip()
        if not self._stocks:
            return []

        q_tokens = frozenset(q.replace("-", " ").split())

        q_prefixes: list[str] = []
        for length in range(3, min(len(q), 8) + 1):
            q_prefixes.append(q[:length])

        scored: list[tuple[float, _CachedStock]] = []

        for s in self._stocks:
            sym_ratio = SequenceMatcher(None, q, s.symbol_upper).ratio()
            name_ratio = SequenceMatcher(None, q, s.name_upper).ratio()

            bonus = 0.0
            if q in s.symbol_upper or s.symbol_upper in q:
                bonus += 0.3
            if q == s.symbol_upper:
                bonus += 0.5

            common = q_tokens & s.name_tokens
            if common:
                bonus += len(common) * 0.15

            for pfx in q_prefixes:
                if s.symbol_upper.startswith(pfx) or pfx in s.name_upper:
                    bonus += len(pfx) * 0.03
                    break

            score = max(sym_ratio, name_ratio) + bonus
            if score > 0.3:
                scored.append((score, s))

        scored.sort(key=lambda x: -x[0])
        return [
            {"symbol": s.symbol, "company_name": s.company_name, "score": round(sc, 3)}
            for sc, s in scored[:top_n]
        ]


_cache = _StockCache()


async def _load_cache_from_db():
    async with async_session() as db:
        result = await db.execute(select(NseStock))
        rows = result.scalars().all()
        if rows:
            _cache.load([
                {"symbol": r.symbol, "company_name": r.company_name, "isin": r.isin}
                for r in rows
            ])
            print(f"Stock cache: loaded {len(rows)} stocks from DB")


def _parse_fyers_csv(text: str) -> list[dict]:
    """Parse Fyers NSE_CM.csv — no header row, columns are positional."""
    seen: set[str] = set()
    stocks = []
    reader = csv.reader(io.StringIO(text))
    for row in reader:
        if len(row) < 14:
            continue
        fyers_symbol = row[9].strip()  # e.g. NSE:RELIANCE-EQ
        if not fyers_symbol.endswith("-EQ"):
            continue
        symbol = row[13].strip()  # short symbol e.g. RELIANCE
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        company_name = row[1].strip()
        isin = row[5].strip()
        stocks.append({
            "symbol": symbol,
            "company_name": company_name,
            "isin": isin,
            "series": "EQ",
        })
    return stocks


async def fetch_nse_master_list() -> list[dict]:
    """Fetch all NSE equity symbols from Fyers public symbols master."""
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        resp = await client.get(FYERS_SYMBOLS_URL)
        resp.raise_for_status()

        if not resp.text.strip():
            raise ValueError("Fyers symbols CSV is empty")

        stocks = _parse_fyers_csv(resp.text)
        if not stocks:
            raise ValueError("No EQ stocks found in Fyers symbols CSV")

        print(f"Fyers symbols: parsed {len(stocks)} equity stocks")
        return stocks


async def refresh_nse_master_list() -> dict:
    try:
        stocks = await fetch_nse_master_list()
        if not stocks:
            await _load_cache_from_db()
            return {"status": "empty", "count": 0}

        async with async_session() as db:
            async with db.begin():
                await db.execute(delete(NseStock))
                now = datetime.now(timezone.utc)
                for s in stocks:
                    db.add(NseStock(
                        symbol=s["symbol"],
                        company_name=s["company_name"],
                        series=s["series"],
                        isin=s["isin"],
                        updated_at=now,
                    ))

        _cache.load(stocks)
        print(f"Stock master list: loaded {len(stocks)} stocks from Fyers")
        return {"status": "ok", "count": len(stocks)}
    except Exception as e:
        print(f"Stock master list fetch error: {e}")
        await _load_cache_from_db()
        return {"status": "error", "error": str(e)}


def search_nse_stocks(query: str, limit: int = 10) -> list[dict]:
    return _cache.search(query, limit)


def fuzzy_match_ticker(ticker: str, top_n: int = 5) -> list[dict]:
    return _cache.fuzzy_match(ticker, top_n)


def is_valid_nse_symbol(symbol: str) -> bool:
    return _cache.has_symbol(symbol)


def get_nse_symbol_set() -> set[str]:
    return _cache.symbol_set


async def get_mapping_status(db: AsyncSession) -> list[dict]:
    lots_result = await db.execute(select(Lot.ticker).distinct())
    lot_tickers = [r[0] for r in lots_result.all()]

    nse_symbols = _cache.symbol_set
    mappings = []
    for ticker in sorted(lot_tickers):
        if ticker in nse_symbols:
            mappings.append({"ticker": ticker, "status": "verified", "suggestions": []})
        else:
            suggestions = _cache.fuzzy_match(ticker)
            mappings.append({"ticker": ticker, "status": "unmatched", "suggestions": suggestions})

    return mappings


async def remap_ticker(db: AsyncSession, old_ticker: str, new_ticker: str) -> dict:
    from ..models import RealizedPnL, PriceCache

    lots_result = await db.execute(select(Lot).where(Lot.ticker == old_ticker))
    lots = lots_result.scalars().all()

    pnl_result = await db.execute(select(RealizedPnL).where(RealizedPnL.ticker == old_ticker))
    pnls = pnl_result.scalars().all()

    updated = 0
    for lot in lots:
        lot.ticker = new_ticker
        updated += 1
    for pnl in pnls:
        pnl.ticker = new_ticker

    old_price = await db.get(PriceCache, old_ticker)
    if old_price:
        await db.delete(old_price)

    await db.commit()
    return {"old_ticker": old_ticker, "new_ticker": new_ticker, "lots_updated": updated}
