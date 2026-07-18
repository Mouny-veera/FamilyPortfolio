import asyncio
import json
from datetime import date, timedelta, datetime, timezone
from pathlib import Path

from sqlalchemy import delete

from ..database import async_session
from ..models import ScanResult
from ..services.market_data import get_active_provider
from .base_strategy import BaseStrategy
from .fibonacci_strategy import FibonacciRetracementStrategy

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"
NIFTY200_FILE = DATA_DIR / "nifty200.json"

STRATEGIES: list[BaseStrategy] = [
    FibonacciRetracementStrategy(),
]

_scan_lock = asyncio.Lock()


def _load_scanner_universe() -> list[str]:
    if NIFTY200_FILE.exists():
        data = json.loads(NIFTY200_FILE.read_text())
        return data.get("constituents", [])
    return []


async def run_scan() -> list[dict]:
    if _scan_lock.locked():
        raise RuntimeError("A scan is already in progress")

    async with _scan_lock:
        universe = _load_scanner_universe()
        if not universe:
            raise RuntimeError("Scanner universe is empty — check data/nifty200.json")

        provider = get_active_provider()
        end = date.today()
        start = end - timedelta(days=180)
        results = []
        errors = 0

        for strategy in STRATEGIES:
            for ticker in universe:
                try:
                    ohlc = await provider.get_historical_ohlc(ticker, start, end)
                    if ohlc is None:
                        continue
                    scan_score = await strategy.score(ticker, ohlc)
                    if scan_score and scan_score.score > 0:
                        results.append({
                            "ticker": scan_score.ticker,
                            "score": scan_score.score,
                            "strategy_name": strategy.name,
                            "metrics": scan_score.metrics,
                        })
                except Exception as e:
                    errors += 1
                    print(f"Scanner error for {ticker}: {e}")
                await asyncio.sleep(0.5)

        success_rate = (len(universe) - errors) / len(universe) if universe else 0
        if success_rate < 0.5 and results:
            print(f"Scan had {errors}/{len(universe)} failures ({success_rate:.0%} success) — keeping previous results")
            return results
        if not results and errors > 0:
            print(f"Scan produced 0 results with {errors} errors — keeping previous results")
            return []

        async with async_session() as db:
            async with db.begin():
                await db.execute(delete(ScanResult))
                for r in results:
                    db.add(ScanResult(
                        ticker=r["ticker"],
                        score=r["score"],
                        strategy_name=r["strategy_name"],
                        metrics=r["metrics"],
                        scanned_at=datetime.now(timezone.utc),
                    ))

        return results
