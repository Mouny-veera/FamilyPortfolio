import pandas as pd

from .base_strategy import BaseStrategy, ScanScore


class BollingerStrategy(BaseStrategy):
    @property
    def name(self) -> str:
        return "bollinger"

    async def score(self, ticker: str, ohlc: pd.DataFrame) -> ScanScore | None:
        if ohlc is None or len(ohlc) < 25:
            return None

        period = 20
        multiplier = 2.0

        close = ohlc["close"]

        sma = close.rolling(window=period).mean()
        std = close.rolling(window=period).std(ddof=0)

        upper = sma + multiplier * std
        lower = sma - multiplier * std

        band_width = upper - lower
        denom = sma.replace(0, float("inf"))
        bandwidth_pct = (band_width / denom * 100)

        current_close = float(close.iloc[-1])
        current_upper = float(upper.iloc[-1])
        current_lower = float(lower.iloc[-1])
        current_sma = float(sma.iloc[-1])
        current_bw = float(bandwidth_pct.iloc[-1])

        band_range = current_upper - current_lower
        if band_range == 0:
            return None

        pct_b = (current_close - current_lower) / band_range

        # Squeeze detection: bandwidth at 6-month low
        bw_min = float(bandwidth_pct.tail(len(ohlc)).min())
        is_squeeze = current_bw <= bw_min * 1.05

        # Bollinger bounce: price at lower band and turning up
        price_rising = float(close.iloc[-1]) > float(close.iloc[-2])

        score = 0.0
        signal = "neutral"

        if pct_b < 0 and price_rising:
            score = 90
            signal = "bounce_below_lower"
        elif pct_b < 0:
            score = 80
            signal = "below_lower"
        elif pct_b < 0.2 and price_rising:
            score = 75
            signal = "near_lower_recovering"
        elif is_squeeze:
            score = 70
            signal = "squeeze"
        elif pct_b > 1.0:
            score = 20
            signal = "above_upper"
        elif pct_b > 0.8:
            score = 30
            signal = "near_upper"
        elif 0.4 <= pct_b <= 0.6:
            score = 45
            signal = "mid_band"
        elif pct_b < 0.4:
            score = 60
            signal = "lower_half"
        else:
            score = 35
            signal = "upper_half"

        return ScanScore(
            ticker=ticker,
            score=round(max(0, min(100, score)), 2),
            metrics={
                "current": round(current_close, 2),
                "upper": round(current_upper, 2),
                "lower": round(current_lower, 2),
                "sma": round(current_sma, 2),
                "pct_b": round(pct_b, 4),
                "bandwidth": round(current_bw, 2),
                "squeeze": is_squeeze,
                "signal": signal,
            },
        )
