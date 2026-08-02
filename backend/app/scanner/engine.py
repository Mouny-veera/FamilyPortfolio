import asyncio
from datetime import date, timedelta, datetime, timezone

from sqlalchemy import delete

from ..database import async_session
from ..models import ScanResult
from ..services.market_data import get_active_provider
from ..services.nifty_index import refresh_nifty_universe, load_nifty_universe
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
from .low52w_strategy import Low52WStrategy
from .composite import compute_composite

import logging
logger = logging.getLogger(__name__)

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
    Low52WStrategy(),
]

_scan_lock = asyncio.Lock()


async def run_scan() -> list[dict]:
    if _scan_lock.locked():
        raise RuntimeError("A scan is already in progress")

    async with _scan_lock:
        try:
            await refresh_nifty_universe()
        except Exception as e:
            logger.error("[Scanner] Nifty 500 refresh failed, using cached: %s", e)
        universe = load_nifty_universe()
        if not universe:
            raise RuntimeError("Scanner universe is empty — check data/nifty500.json")

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
                        logger.error("Scanner %s error for %s: %s", strategy.name, ticker, e)

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
                logger.error("Scanner fetch error for %s: %s", ticker, e)
            await asyncio.sleep(0.3)

        results.extend(composite_results)

        success_rate = (len(universe) - errors) / len(universe) if universe else 0
        if success_rate < 0.5 and results:
            logger.error("Scan had %s/%s failures (%.0%% success) — keeping previous results", errors, len(universe), success_rate)
            return results
        if not results and errors > 0:
            logger.error("Scan produced 0 results with %s errors — keeping previous results", errors)
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
