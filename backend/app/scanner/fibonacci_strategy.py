import pandas as pd

from .base_strategy import BaseStrategy, ScanScore


class FibonacciRetracementStrategy(BaseStrategy):
    @property
    def name(self) -> str:
        return "fibonacci_retracement"

    async def score(self, ticker: str, ohlc: pd.DataFrame) -> ScanScore | None:
        if ohlc is None or len(ohlc) < 10:
            return None

        high = ohlc["high"].max()
        low = ohlc["low"].min()
        current = ohlc["close"].iloc[-1]

        if high == low:
            return None

        diff = high - low
        fib_236 = high - diff * 0.236
        fib_382 = high - diff * 0.382
        fib_500 = high - diff * 0.500
        fib_618 = high - diff * 0.618

        proximity_618 = abs(current - fib_618) / diff if diff else 1
        near_618 = proximity_618 < 0.05

        proximity_500 = abs(current - fib_500) / diff if diff else 1
        proximity_382 = abs(current - fib_382) / diff if diff else 1

        score = 0.0
        if near_618:
            score = 90 - (proximity_618 * 100)
        elif proximity_500 < 0.05:
            score = 70 - (proximity_500 * 100)
        elif proximity_382 < 0.05:
            score = 50 - (proximity_382 * 100)
        elif current <= fib_618:
            score = 80 - (abs(current - fib_618) / diff * 50)
        else:
            retracement = (high - current) / diff
            score = max(0, retracement * 40)

        return ScanScore(
            ticker=ticker,
            score=round(max(0, min(100, score)), 2),
            metrics={
                "high_6m": round(high, 2),
                "low_6m": round(low, 2),
                "current": round(current, 2),
                "fib_236": round(fib_236, 2),
                "fib_382": round(fib_382, 2),
                "fib_500": round(fib_500, 2),
                "fib_618": round(fib_618, 2),
                "proximity_618": round(proximity_618, 4),
                "near_618": bool(near_618),
            },
        )
