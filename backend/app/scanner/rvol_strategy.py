import pandas as pd

from .base_strategy import BaseStrategy, ScanScore


class RVOLStrategy(BaseStrategy):
    @property
    def name(self) -> str:
        return "rvol"

    async def score(self, ticker: str, ohlc: pd.DataFrame) -> ScanScore | None:
        if ohlc is None or len(ohlc) < 25:
            return None

        close = ohlc["close"]
        volume = ohlc["volume"]

        avg_volume_20 = volume.rolling(window=20).mean()
        current_vol = float(volume.iloc[-1])
        avg_vol = float(avg_volume_20.iloc[-1])

        if avg_vol == 0:
            return None

        rvol = current_vol / avg_vol

        price_change = float(close.iloc[-1] - close.iloc[-2])
        price_change_pct = price_change / float(close.iloc[-2]) * 100

        # OBV trend (last 20 bars)
        obv = pd.Series(0.0, index=ohlc.index)
        for i in range(1, len(ohlc)):
            if close.iloc[i] > close.iloc[i - 1]:
                obv.iloc[i] = obv.iloc[i - 1] + volume.iloc[i]
            elif close.iloc[i] < close.iloc[i - 1]:
                obv.iloc[i] = obv.iloc[i - 1] - volume.iloc[i]
            else:
                obv.iloc[i] = obv.iloc[i - 1]

        obv_sma = obv.rolling(20).mean()
        obv_above_sma = float(obv.iloc[-1]) > float(obv_sma.iloc[-1])

        # Volume trend: rising if 5-day avg > 20-day avg
        avg_volume_5 = float(volume.tail(5).mean())
        volume_trending_up = avg_volume_5 > avg_vol

        score = 0.0
        signal = "normal"

        if rvol >= 3.0 and price_change > 0:
            score = 95
            signal = "extreme_volume_bullish"
        elif rvol >= 2.0 and price_change > 0:
            score = 85
            signal = "high_volume_bullish"
        elif rvol >= 1.5 and price_change > 0 and obv_above_sma:
            score = 75
            signal = "accumulation"
        elif rvol >= 2.0 and price_change < 0:
            score = 25
            signal = "high_volume_bearish"
        elif rvol >= 3.0 and price_change < 0:
            score = 10
            signal = "extreme_volume_bearish"
        elif volume_trending_up and obv_above_sma:
            score = 60
            signal = "rising_volume"
        elif rvol < 0.5:
            score = 40
            signal = "low_volume"
        else:
            score = 50
            signal = "normal"

        return ScanScore(
            ticker=ticker,
            score=round(max(0, min(100, score)), 2),
            metrics={
                "current": round(float(close.iloc[-1]), 2),
                "rvol": round(rvol, 2),
                "current_volume": int(current_vol),
                "avg_volume_20": int(avg_vol),
                "price_change_pct": round(price_change_pct, 2),
                "obv_above_sma": obv_above_sma,
                "signal": signal,
            },
        )
