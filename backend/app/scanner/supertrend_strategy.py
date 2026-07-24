import pandas as pd
import numpy as np

from .base_strategy import BaseStrategy, ScanScore


class SuperTrendStrategy(BaseStrategy):
    @property
    def name(self) -> str:
        return "supertrend"

    async def score(self, ticker: str, ohlc: pd.DataFrame) -> ScanScore | None:
        if ohlc is None or len(ohlc) < 20:
            return None

        period = 10
        multiplier = 3.0

        high = ohlc["high"]
        low = ohlc["low"]
        close = ohlc["close"]

        hl2 = (high + low) / 2

        # ATR via Wilder's smoothing
        tr = pd.concat([
            high - low,
            (high - close.shift(1)).abs(),
            (low - close.shift(1)).abs(),
        ], axis=1).max(axis=1)
        atr = tr.ewm(alpha=1 / period, adjust=False).mean()

        basic_upper = hl2 + multiplier * atr
        basic_lower = hl2 - multiplier * atr

        n = len(ohlc)
        upper_band = np.zeros(n)
        lower_band = np.zeros(n)
        supertrend = np.zeros(n)
        direction = np.zeros(n)  # 1 = bullish, -1 = bearish

        upper_band[0] = basic_upper.iloc[0]
        lower_band[0] = basic_lower.iloc[0]
        supertrend[0] = upper_band[0]
        direction[0] = -1

        for i in range(1, n):
            # Upper band: take min with previous to prevent expansion during downtrend
            if basic_upper.iloc[i] < upper_band[i - 1] or close.iloc[i - 1] > upper_band[i - 1]:
                upper_band[i] = basic_upper.iloc[i]
            else:
                upper_band[i] = upper_band[i - 1]

            # Lower band: take max with previous to prevent contraction during uptrend
            if basic_lower.iloc[i] > lower_band[i - 1] or close.iloc[i - 1] < lower_band[i - 1]:
                lower_band[i] = basic_lower.iloc[i]
            else:
                lower_band[i] = lower_band[i - 1]

            # Direction flip
            if direction[i - 1] == 1:
                if close.iloc[i] < lower_band[i]:
                    direction[i] = -1
                    supertrend[i] = upper_band[i]
                else:
                    direction[i] = 1
                    supertrend[i] = lower_band[i]
            else:
                if close.iloc[i] > upper_band[i]:
                    direction[i] = 1
                    supertrend[i] = lower_band[i]
                else:
                    direction[i] = -1
                    supertrend[i] = upper_band[i]

        current_dir = direction[-1]
        prev_dir = direction[-2]
        current_close = float(close.iloc[-1])
        current_st = float(supertrend[-1])

        bullish_flip = prev_dir == -1 and current_dir == 1
        bearish_flip = prev_dir == 1 and current_dir == -1

        # Count consecutive bars in current direction
        streak = 1
        for i in range(n - 2, -1, -1):
            if direction[i] == current_dir:
                streak += 1
            else:
                break

        score = 0.0
        signal = "neutral"

        if bullish_flip:
            score = 92
            signal = "bullish_flip"
        elif bearish_flip:
            score = 10
            signal = "bearish_flip"
        elif current_dir == 1:
            dist_pct = (current_close - current_st) / current_close * 100
            score = min(85, 60 + streak * 2 + dist_pct)
            signal = "bullish"
        else:
            dist_pct = (current_st - current_close) / current_close * 100
            score = max(5, 35 - streak * 2 - dist_pct)
            signal = "bearish"

        return ScanScore(
            ticker=ticker,
            score=round(max(0, min(100, score)), 2),
            metrics={
                "current": round(current_close, 2),
                "supertrend": round(current_st, 2),
                "direction": "bullish" if current_dir == 1 else "bearish",
                "streak": streak,
                "signal": signal,
            },
        )
