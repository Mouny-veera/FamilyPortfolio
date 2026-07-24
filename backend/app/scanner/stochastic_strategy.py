import pandas as pd

from .base_strategy import BaseStrategy, ScanScore


class StochasticStrategy(BaseStrategy):
    @property
    def name(self) -> str:
        return "stochastic"

    async def score(self, ticker: str, ohlc: pd.DataFrame) -> ScanScore | None:
        if ohlc is None or len(ohlc) < 20:
            return None

        k_period = 14
        d_period = 3

        high = ohlc["high"]
        low = ohlc["low"]
        close = ohlc["close"]

        lowest_low = low.rolling(window=k_period).min()
        highest_high = high.rolling(window=k_period).max()

        denom = highest_high - lowest_low
        denom = denom.replace(0, float("inf"))

        pct_k = 100 * (close - lowest_low) / denom
        pct_d = pct_k.rolling(window=d_period).mean()

        current_k = float(pct_k.iloc[-1])
        current_d = float(pct_d.iloc[-1])
        prev_k = float(pct_k.iloc[-2])
        prev_d = float(pct_d.iloc[-2])
        current_close = float(close.iloc[-1])

        bullish_cross = prev_k < prev_d and current_k >= current_d
        bearish_cross = prev_k > prev_d and current_k <= current_d
        oversold = current_k < 20
        overbought = current_k > 80

        score = 0.0
        signal = "neutral"

        if bullish_cross and oversold:
            score = 95
            signal = "bullish_cross_oversold"
        elif bullish_cross:
            score = 75
            signal = "bullish_cross"
        elif oversold and current_k > prev_k:
            score = 80
            signal = "oversold_recovering"
        elif oversold:
            score = 70
            signal = "oversold"
        elif bearish_cross and overbought:
            score = 10
            signal = "bearish_cross_overbought"
        elif bearish_cross:
            score = 25
            signal = "bearish_cross"
        elif overbought:
            score = 15
            signal = "overbought"
        elif current_k > 50:
            score = 45
            signal = "bullish_zone"
        else:
            score = 55
            signal = "bearish_zone"

        return ScanScore(
            ticker=ticker,
            score=round(max(0, min(100, score)), 2),
            metrics={
                "current": round(current_close, 2),
                "pct_k": round(current_k, 2),
                "pct_d": round(current_d, 2),
                "oversold": oversold,
                "overbought": overbought,
                "signal": signal,
            },
        )
