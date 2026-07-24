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
from .pivot_strategy import PivotPointStrategy
from .macd_strategy import MACDStrategy
from .rsi_strategy import RSIStrategy
from .supertrend_strategy import SuperTrendStrategy
from .adx_strategy import ADXStrategy
from .stochastic_strategy import StochasticStrategy
from .rvol_strategy import RVOLStrategy
from .bollinger_strategy import BollingerStrategy
from .high52w_strategy import High52WStrategy
from .composite import compute_composite

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"
NIFTY200_FILE = DATA_DIR / "nifty200.json"

STRATEGIES: list[BaseStrategy] = [
    FibonacciRetracementStrategy(),
    PivotPointStrategy(),
    MACDStrategy(),
    RSIStrategy(),
    SuperTrendStrategy(),
    ADXStrategy(),
    StochasticStrategy(),
    RVOLStrategy(),
    BollingerStrategy(),
    High52WStrategy(),
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
        # 1Y lookback for 52W high strategy; other strategies use what they need
        start = end - timedelta(days=365)
        results = []
        composite_results = []
        errors = 0

        for ticker in universe:
            try:
                ohlc = await provider.get_historical_ohlc(ticker, start, end)
                if ohlc is None:
                    continue

                ohlc = ohlc.dropna(subset=["open", "high", "low", "close"])
                if len(ohlc) < 20:
                    continue

                ticker_scores: dict[str, float] = {}

                for strategy in STRATEGIES:
                    try:
                        scan_score = await strategy.score(ticker, ohlc)
                        if scan_score and scan_score.score > 0:
                            results.append({
                                "ticker": scan_score.ticker,
                                "score": scan_score.score,
                                "strategy_name": strategy.name,
                                "metrics": scan_score.metrics,
                            })
                            ticker_scores[strategy.name] = scan_score.score
                    except Exception as e:
                        print(f"Scanner {strategy.name} error for {ticker}: {e}")

                # Compute composite if we have enough strategy data
                if len(ticker_scores) >= 3:
                    comp = compute_composite(ticker_scores)
                    composite_results.append({
                        "ticker": ticker,
                        "score": comp["composite_score"],
                        "strategy_name": "composite",
                        "metrics": {
                            "rating": comp["rating"],
                            "category_scores": comp["category_scores"],
                            "strategies_used": comp["strategies_used"],
                            "current": results[-1]["metrics"].get("current") if results else None,
                        },
                    })
            except Exception as e:
                errors += 1
                print(f"Scanner fetch error for {ticker}: {e}")
            await asyncio.sleep(0.3)

        results.extend(composite_results)

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
