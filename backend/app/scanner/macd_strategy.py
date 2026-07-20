import pandas as pd

from .base_strategy import BaseStrategy, ScanScore


class MACDStrategy(BaseStrategy):
    @property
    def name(self) -> str:
        return "macd"

    async def score(self, ticker: str, ohlc: pd.DataFrame) -> ScanScore | None:
        if ohlc is None or len(ohlc) < 35:
            return None

        close = ohlc["close"]

        ema_12 = close.ewm(span=12, adjust=False).mean()
        ema_26 = close.ewm(span=26, adjust=False).mean()
        macd_line = ema_12 - ema_26
        signal_line = macd_line.ewm(span=9, adjust=False).mean()
        histogram = macd_line - signal_line

        current_macd = macd_line.iloc[-1]
        current_signal = signal_line.iloc[-1]
        current_hist = histogram.iloc[-1]
        prev_hist = histogram.iloc[-2]
        current_close = close.iloc[-1]

        bullish_cross = macd_line.iloc[-2] < signal_line.iloc[-2] and current_macd >= current_signal
        bearish_cross = macd_line.iloc[-2] > signal_line.iloc[-2] and current_macd <= current_signal

        hist_rising = current_hist > prev_hist
        hist_positive = current_hist > 0

        score = 0.0
        signal = "neutral"

        if bullish_cross:
            score = 90
            signal = "bullish_cross"
        elif bearish_cross:
            score = 15
            signal = "bearish_cross"
        elif current_macd > current_signal and hist_rising:
            score = 75
            signal = "bullish_momentum"
        elif current_macd > current_signal and not hist_rising:
            score = 55
            signal = "bullish_weakening"
        elif current_macd < current_signal and not hist_rising:
            score = 20
            signal = "bearish_momentum"
        elif current_macd < current_signal and hist_rising:
            score = 40
            signal = "bearish_weakening"

        return ScanScore(
            ticker=ticker,
            score=round(max(0, min(100, score)), 2),
            metrics={
                "current": round(current_close, 2),
                "macd": round(current_macd, 4),
                "signal_line": round(current_signal, 4),
                "histogram": round(current_hist, 4),
                "bullish_cross": bool(bullish_cross),
                "bearish_cross": bool(bearish_cross),
                "hist_rising": bool(hist_rising),
                "signal": signal,
            },
        )
