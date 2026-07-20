import pandas as pd

from .base_strategy import BaseStrategy, ScanScore


class PivotPointStrategy(BaseStrategy):
    @property
    def name(self) -> str:
        return "pivot_point"

    async def score(self, ticker: str, ohlc: pd.DataFrame) -> ScanScore | None:
        if ohlc is None or len(ohlc) < 5:
            return None

        prev = ohlc.iloc[-2]
        current_close = ohlc["close"].iloc[-1]

        high = prev["high"]
        low = prev["low"]
        close = prev["close"]

        pivot = (high + low + close) / 3
        r1 = 2 * pivot - low
        r2 = pivot + (high - low)
        r3 = high + 2 * (pivot - low)
        s1 = 2 * pivot - high
        s2 = pivot - (high - low)
        s3 = low - 2 * (high - pivot)

        range_total = r3 - s3
        if range_total == 0:
            return None

        score = 0.0
        signal = "neutral"

        dist_s1 = abs(current_close - s1) / range_total
        dist_s2 = abs(current_close - s2) / range_total
        dist_pivot = abs(current_close - pivot) / range_total

        if current_close <= s2 and current_close > s3:
            score = 85 - dist_s2 * 50
            signal = "near_s2"
        elif current_close <= s1 and current_close > s2:
            score = 70 - dist_s1 * 30
            signal = "near_s1"
        elif abs(current_close - pivot) / range_total < 0.03:
            score = 55
            signal = "at_pivot"
        elif current_close > pivot and current_close < r1:
            score = 40 - dist_pivot * 20
            signal = "above_pivot"
        elif current_close >= r1 and current_close < r2:
            score = 25
            signal = "near_r1"
        elif current_close < pivot:
            score = 60 - dist_pivot * 30
            signal = "below_pivot"

        return ScanScore(
            ticker=ticker,
            score=round(max(0, min(100, score)), 2),
            metrics={
                "current": round(current_close, 2),
                "pivot": round(pivot, 2),
                "r1": round(r1, 2),
                "r2": round(r2, 2),
                "r3": round(r3, 2),
                "s1": round(s1, 2),
                "s2": round(s2, 2),
                "s3": round(s3, 2),
                "signal": signal,
            },
        )
