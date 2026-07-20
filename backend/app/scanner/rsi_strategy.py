import pandas as pd

from .base_strategy import BaseStrategy, ScanScore


class RSIStrategy(BaseStrategy):
    @property
    def name(self) -> str:
        return "rsi"

    async def score(self, ticker: str, ohlc: pd.DataFrame) -> ScanScore | None:
        if ohlc is None or len(ohlc) < 20:
            return None

        close = ohlc["close"]
        delta = close.diff()

        gain = delta.where(delta > 0, 0.0)
        loss = (-delta).where(delta < 0, 0.0)

        avg_gain = gain.ewm(span=14, adjust=False).mean()
        avg_loss = loss.ewm(span=14, adjust=False).mean()

        rs = avg_gain / avg_loss.replace(0, float("inf"))
        rsi = 100 - (100 / (1 + rs))

        current_rsi = rsi.iloc[-1]
        prev_rsi = rsi.iloc[-2]
        current_close = close.iloc[-1]

        rsi_rising = current_rsi > prev_rsi

        score = 0.0
        signal = "neutral"

        if current_rsi <= 30:
            score = 85 + (30 - current_rsi)
            signal = "oversold"
        elif current_rsi <= 40 and rsi_rising:
            score = 70
            signal = "recovering"
        elif current_rsi <= 40:
            score = 55
            signal = "weak"
        elif 40 < current_rsi <= 60:
            score = 45
            signal = "neutral"
        elif 60 < current_rsi <= 70:
            score = 30
            signal = "strong"
        elif current_rsi > 70:
            score = 15
            signal = "overbought"

        return ScanScore(
            ticker=ticker,
            score=round(max(0, min(100, score)), 2),
            metrics={
                "current": round(current_close, 2),
                "rsi": round(current_rsi, 2),
                "prev_rsi": round(prev_rsi, 2),
                "rsi_rising": bool(rsi_rising),
                "signal": signal,
            },
        )
