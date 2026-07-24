import pandas as pd

from .base_strategy import BaseStrategy, ScanScore


class High52WStrategy(BaseStrategy):
    @property
    def name(self) -> str:
        return "52w_high"

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

        pct_from_high = (current_close - high_52w) / high_52w * 100
        pct_from_low = (current_close - low_52w) / low_52w * 100

        # Position in 52W range (0 = at low, 1 = at high)
        range_position = (current_close - low_52w) / (high_52w - low_52w)

        # New high today
        is_new_high = current_close >= high_52w * 0.998

        # Volume confirmation
        avg_vol = float(volume.tail(20).mean())
        current_vol = float(volume.iloc[-1])
        rvol = current_vol / avg_vol if avg_vol > 0 else 1.0
        vol_confirmation = rvol > 1.5

        # Price momentum: 5-day rate of change
        roc_5 = (current_close - float(close.iloc[-6])) / float(close.iloc[-6]) * 100 if len(close) >= 6 else 0

        score = 0.0
        signal = "neutral"

        if is_new_high and vol_confirmation:
            score = 95
            signal = "new_high_volume"
        elif is_new_high:
            score = 85
            signal = "new_high"
        elif pct_from_high >= -5:
            score = 75 + (5 + pct_from_high) * 2
            signal = "near_high"
        elif pct_from_high >= -10:
            score = 60
            signal = "within_10pct"
        elif range_position > 0.7:
            score = 50
            signal = "upper_range"
        elif range_position < 0.2:
            score = 70 if roc_5 > 0 else 30
            signal = "near_low_recovering" if roc_5 > 0 else "near_low"
        elif range_position < 0.5:
            score = 45
            signal = "lower_half"
        else:
            score = 40
            signal = "mid_range"

        return ScanScore(
            ticker=ticker,
            score=round(max(0, min(100, score)), 2),
            metrics={
                "current": round(current_close, 2),
                "high_52w": round(high_52w, 2),
                "low_52w": round(low_52w, 2),
                "pct_from_high": round(pct_from_high, 2),
                "pct_from_low": round(pct_from_low, 2),
                "range_position": round(range_position, 4),
                "rvol": round(rvol, 2),
                "signal": signal,
            },
        )
