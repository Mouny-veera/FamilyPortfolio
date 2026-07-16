from abc import ABC, abstractmethod
from datetime import date
import json
from pathlib import Path

import pandas as pd


CONFIG_PATH = Path(__file__).resolve().parent.parent.parent.parent / "data" / "config.json"


def load_config() -> dict:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text())
    return {}


def save_config(config: dict):
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(config, indent=2))


class MarketDataProvider(ABC):
    @abstractmethod
    async def get_live_price(self, ticker: str) -> dict[str, float] | None:
        """Returns {"last_price": float, "change_pct": float} or None."""
        ...

    @abstractmethod
    async def get_historical_ohlc(
        self, ticker: str, start: date, end: date
    ) -> pd.DataFrame | None:
        """Returns DataFrame with columns: Date, Open, High, Low, Close, Volume."""
        ...

    @abstractmethod
    async def get_bulk_prices(self, tickers: list[str]) -> dict[str, dict[str, float]]:
        """Returns {ticker: {"last_price": float, "change_pct": float}}."""
        ...

    @abstractmethod
    async def get_nifty200_constituents(self) -> list[str]:
        """Returns list of NSE ticker symbols in Nifty 200."""
        ...

    @abstractmethod
    async def get_gainers_losers(self) -> dict[str, list[dict]]:
        """Returns {"gainers": [...], "losers": [...]}."""
        ...


class YFinanceProvider(MarketDataProvider):
    def _nse_symbol(self, ticker: str) -> str:
        return f"{ticker}.NS"

    async def get_live_price(self, ticker: str) -> dict[str, float] | None:
        import yfinance as yf
        import asyncio
        try:
            t = await asyncio.to_thread(lambda: yf.Ticker(self._nse_symbol(ticker)))
            fi = await asyncio.to_thread(lambda: t.fast_info)
            price = fi.last_price
            prev = fi.previous_close
            if price is None:
                return None
            change = ((price - prev) / prev * 100) if prev else 0
            return {"last_price": round(price, 2), "change_pct": round(change, 2)}
        except Exception as e:
            print(f"Live price error for {ticker}: {e}")
            return None

    async def get_historical_ohlc(
        self, ticker: str, start: date, end: date
    ) -> pd.DataFrame | None:
        import yfinance as yf
        import asyncio
        try:
            t = await asyncio.to_thread(lambda: yf.Ticker(self._nse_symbol(ticker)))
            df = await asyncio.to_thread(
                lambda: t.history(start=start.isoformat(), end=end.isoformat())
            )
            if df.empty:
                return None
            df = df.reset_index()
            df = df.rename(columns={"Date": "date", "Open": "open", "High": "high", "Low": "low", "Close": "close", "Volume": "volume"})
            return df[["date", "open", "high", "low", "close", "volume"]]
        except Exception as e:
            print(f"Historical OHLC error for {ticker}: {e}")
            return None

    async def get_bulk_prices(self, tickers: list[str]) -> dict[str, dict[str, float]]:
        import yfinance as yf
        import asyncio
        symbols = [self._nse_symbol(t) for t in tickers]
        try:
            data = await asyncio.to_thread(
                lambda: yf.download(symbols, period="5d", progress=False)
            )
            result = {}
            if data.empty:
                return result
            for ticker in tickers:
                sym = self._nse_symbol(ticker)
                try:
                    closes = data["Close"][sym].dropna()
                    if len(closes) < 1:
                        continue
                    last = float(closes.iloc[-1])
                    prev = float(closes.iloc[-2]) if len(closes) >= 2 else last
                    change = ((last - prev) / prev * 100) if prev else 0
                    result[ticker] = {"last_price": round(last, 2), "change_pct": round(change, 2)}
                except (KeyError, IndexError):
                    continue
            return result
        except Exception as e:
            print(f"yfinance bulk download error: {e}")
            return {}

    async def get_nifty200_constituents(self) -> list[str]:
        return []

    async def get_gainers_losers(self) -> dict[str, list[dict]]:
        return {"gainers": [], "losers": []}


class FyersProvider(MarketDataProvider):
    def __init__(self, client_id: str, access_token: str):
        from fyers_apiv3 import fyersModel
        self._client_id = client_id
        self._access_token = access_token
        self._fyers = fyersModel.FyersModel(
            client_id=client_id,
            token=access_token,
            is_async=False,
            log_path="",
        )

    def _fyers_symbol(self, ticker: str) -> str:
        return f"NSE:{ticker}-EQ"

    async def get_live_price(self, ticker: str) -> dict[str, float] | None:
        import asyncio
        try:
            data = {"symbols": self._fyers_symbol(ticker)}
            resp = await asyncio.to_thread(self._fyers.quotes, data=data)
            if resp.get("s") != "ok" or not resp.get("d"):
                return None
            q = resp["d"][0]["v"]
            lp = q.get("lp")
            if lp is None:
                return None
            chp = q.get("chp", 0)
            return {"last_price": round(float(lp), 2), "change_pct": round(float(chp), 2)}
        except Exception as e:
            print(f"Fyers live price error for {ticker}: {e}")
            return None

    async def get_historical_ohlc(
        self, ticker: str, start: date, end: date
    ) -> pd.DataFrame | None:
        import asyncio
        try:
            data = {
                "symbol": self._fyers_symbol(ticker),
                "resolution": "D",
                "date_format": "1",
                "range_from": start.isoformat(),
                "range_to": end.isoformat(),
                "cont_flag": "1",
            }
            resp = await asyncio.to_thread(self._fyers.history, data=data)
            candles = resp.get("candles")
            if not candles:
                return None
            df = pd.DataFrame(candles, columns=["date", "open", "high", "low", "close", "volume"])
            df["date"] = pd.to_datetime(df["date"], unit="s" if isinstance(candles[0][0], (int, float)) else None)
            return df
        except Exception as e:
            print(f"Fyers historical OHLC error for {ticker}: {e}")
            return None

    async def get_bulk_prices(self, tickers: list[str]) -> dict[str, dict[str, float]]:
        import asyncio
        result = {}
        # Fyers quotes API supports up to 50 symbols per call
        for i in range(0, len(tickers), 50):
            batch = tickers[i:i + 50]
            symbols = ",".join(self._fyers_symbol(t) for t in batch)
            try:
                data = {"symbols": symbols}
                resp = await asyncio.to_thread(self._fyers.quotes, data=data)
                if resp.get("s") != "ok" or not resp.get("d"):
                    continue
                for quote in resp["d"]:
                    v = quote.get("v", {})
                    sym_full = quote.get("n", "")
                    # Extract ticker from "NSE:SBIN-EQ" format
                    ticker_name = sym_full.replace("NSE:", "").replace("-EQ", "")
                    lp = v.get("lp")
                    if lp is None:
                        continue
                    chp = v.get("chp", 0)
                    result[ticker_name] = {
                        "last_price": round(float(lp), 2),
                        "change_pct": round(float(chp), 2),
                    }
            except Exception as e:
                print(f"Fyers bulk price error (batch {i}): {e}")
        return result

    async def get_nifty200_constituents(self) -> list[str]:
        return []

    async def get_gainers_losers(self) -> dict[str, list[dict]]:
        return {"gainers": [], "losers": []}


def get_active_provider() -> MarketDataProvider:
    config = load_config()
    fyers_cfg = config.get("fyers", {})
    if fyers_cfg.get("client_id") and fyers_cfg.get("access_token"):
        try:
            return FyersProvider(
                client_id=fyers_cfg["client_id"],
                access_token=fyers_cfg["access_token"],
            )
        except Exception as e:
            print(f"Fyers init failed, falling back to yfinance: {e}")
    return YFinanceProvider()
