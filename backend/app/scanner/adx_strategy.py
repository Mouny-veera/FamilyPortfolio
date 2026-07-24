import pandas as pd

from .base_strategy import BaseStrategy, ScanScore


class ADXStrategy(BaseStrategy):
    @property
    def name(self) -> str:
        return "adx"

    async def score(self, ticker: str, ohlc: pd.DataFrame) -> ScanScore | None:
        if ohlc is None or len(ohlc) < 30:
            return None

        period = 14
        high = ohlc["high"]
        low = ohlc["low"]
        close = ohlc["close"]

        # +DM / -DM
        up_move = high.diff()
        down_move = -low.diff()

        plus_dm = ((up_move > down_move) & (up_move > 0)).astype(float) * up_move
        minus_dm = ((down_move > up_move) & (down_move > 0)).astype(float) * down_move

        # ATR via Wilder's smoothing
        tr = pd.concat([
            high - low,
            (high - close.shift(1)).abs(),
            (low - close.shift(1)).abs(),
        ], axis=1).max(axis=1)
        atr = tr.ewm(alpha=1 / period, adjust=False).mean()

        # Smoothed +DI / -DI
        smoothed_plus_dm = plus_dm.ewm(alpha=1 / period, adjust=False).mean()
        smoothed_minus_dm = minus_dm.ewm(alpha=1 / period, adjust=False).mean()

        plus_di = 100 * smoothed_plus_dm / atr
        minus_di = 100 * smoothed_minus_dm / atr

        # DX and ADX
        di_sum = plus_di + minus_di
        di_sum = di_sum.replace(0, float("inf"))
        dx = 100 * (plus_di - minus_di).abs() / di_sum
        adx = dx.ewm(alpha=1 / period, adjust=False).mean()

        current_adx = float(adx.iloc[-1])
        prev_adx = float(adx.iloc[-2])
        current_plus_di = float(plus_di.iloc[-1])
        current_minus_di = float(minus_di.iloc[-1])
        prev_plus_di = float(plus_di.iloc[-2])
        prev_minus_di = float(minus_di.iloc[-2])
        current_close = float(close.iloc[-1])

        adx_rising = current_adx > prev_adx
        bullish_cross = prev_plus_di < prev_minus_di and current_plus_di >= current_minus_di
        bearish_cross = prev_plus_di > prev_minus_di and current_plus_di <= current_minus_di
        is_trending = current_adx > 25

        score = 0.0
        signal = "neutral"

        if is_trending and bullish_cross:
            score = 95
            signal = "strong_bullish_cross"
        elif is_trending and current_plus_di > current_minus_di and adx_rising:
            score = 80
            signal = "strong_uptrend"
        elif is_trending and current_plus_di > current_minus_di:
            score = 65
            signal = "uptrend"
        elif bullish_cross and not is_trending:
            score = 55
            signal = "weak_bullish_cross"
        elif not is_trending:
            score = 40
            signal = "ranging"
        elif is_trending and bearish_cross:
            score = 10
            signal = "strong_bearish_cross"
        elif is_trending and current_minus_di > current_plus_di:
            score = 20
            signal = "downtrend"
        else:
            score = 35
            signal = "neutral"

        return ScanScore(
            ticker=ticker,
            score=round(max(0, min(100, score)), 2),
            metrics={
                "current": round(current_close, 2),
                "adx": round(current_adx, 2),
                "plus_di": round(current_plus_di, 2),
                "minus_di": round(current_minus_di, 2),
                "trending": is_trending,
                "adx_rising": adx_rising,
                "signal": signal,
            },
        )
