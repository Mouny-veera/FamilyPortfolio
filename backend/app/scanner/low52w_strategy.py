import pandas as pd

from .base_strategy import BaseStrategy, ScanScore


class Low52WStrategy(BaseStrategy):
    @property
    def name(self) -> str:
        return "52w_low"

    async def score(self, ticker: str, ohlc: pd.DataFrame) -> ScanScore | None:
        if ohlc is None or len(ohlc) < 20:
            return None

        close = ohlc["close"]
        high = ohlc["high"]
        low = ohlc["low"]
        volume = ohlc["volume"]

        high_52w = float(high.max())
        low_52w = float(low.min())
        current_close = float(close.iloc[-1])

        if high_52w == low_52w:
            return None

        pct_from_low = (current_close - low_52w) / low_52w * 100
        pct_from_high = (current_close - high_52w) / high_52w * 100

        range_position = (current_close - low_52w) / (high_52w - low_52w)

        is_new_low = current_close <= low_52w * 1.002

        avg_vol = float(volume.tail(20).mean())
        current_vol = float(volume.iloc[-1])
        rvol = current_vol / avg_vol if avg_vol > 0 else 1.0
        vol_spike = rvol > 1.5

        roc_5 = (current_close - float(close.iloc[-6])) / float(close.iloc[-6]) * 100 if len(close) >= 6 else 0

        score = 0.0
        signal = "neutral"

        if is_new_low and vol_spike:
            score = 95
            signal = "new_low_volume"
        elif is_new_low:
            score = 85
            signal = "new_low"
        elif pct_from_low <= 5:
            if roc_5 > 0:
                score = 80
                signal = "near_low_recovering"
            else:
                score = 75
                signal = "near_low"
        elif pct_from_low <= 10:
            score = 65
            signal = "within_10pct"
        elif range_position < 0.3:
            score = 55
            signal = "lower_range"
        elif range_position < 0.5:
            score = 45
            signal = "lower_half"
        else:
            score = 30
            signal = "upper_half"

        return ScanScore(
            ticker=ticker,
            score=round(max(0, min(100, score)), 2),
            metrics={
                "current": round(current_close, 2),
                "high_52w": round(high_52w, 2),
                "low_52w": round(low_52w, 2),
                "pct_from_low": round(pct_from_low, 2),
                "pct_from_high": round(pct_from_high, 2),
                "range_position": round(range_position, 4),
                "rvol": round(rvol, 2),
                "signal": signal,
            },
        )
