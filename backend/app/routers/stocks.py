import asyncio
import traceback
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query

from ..services.market_data import get_active_provider

router = APIRouter(prefix="/api/stocks", tags=["stocks"])

RESOLUTION_MAP = {
    "1D": ("5", 1),
    "1W": ("15", 7),
    "1M": ("60", 30),
    "3M": ("D", 90),
    "6M": ("D", 180),
    "1Y": ("D", 365),
    "5Y": ("W", 1825),
}


@router.get("/{ticker}/chart")
async def get_stock_chart(
    ticker: str,
    range: str = Query("6M", pattern="^(1D|1W|1M|3M|6M|1Y|5Y)$"),
):
    resolution, days = RESOLUTION_MAP[range]
    provider = get_active_provider()

    end = date.today()
    start = end - timedelta(days=days)

    from ..services.market_data import FyersProvider
    if isinstance(provider, FyersProvider) and resolution not in ("D", "W"):
        from ..services.nse_master import get_fyers_symbol
        symbol = get_fyers_symbol(ticker) or f"NSE:{ticker}-EQ"
        data = {
            "symbol": symbol,
            "resolution": resolution,
            "date_format": "1",
            "range_from": start.isoformat(),
            "range_to": end.isoformat(),
            "cont_flag": "1",
        }
        try:
            resp = await asyncio.to_thread(provider._fyers.history, data=data)
            candles = resp.get("candles")
            if candles:
                return {
                    "candles": [
                        {
                            "time": int(c[0]) if isinstance(c[0], (int, float)) else c[0],
                            "open": round(c[1], 2),
                            "high": round(c[2], 2),
                            "low": round(c[3], 2),
                            "close": round(c[4], 2),
                            "volume": int(c[5]),
                        }
                        for c in candles
                    ],
                    "resolution": resolution,
                }
        except Exception as e:
            print(f"Fyers intraday error for {ticker}: {e}")

    try:
        ohlc = await provider.get_historical_ohlc(ticker, start, end)
    except Exception as e:
        print(f"Chart historical OHLC error for {ticker}: {e}")
        traceback.print_exc()
        ohlc = None

    if ohlc is None or ohlc.empty:
        # Direct yfinance fallback for chart data
        try:
            import yfinance as yf
            symbol = f"{ticker}.NS"
            t = await asyncio.to_thread(lambda: yf.Ticker(symbol))
            df = await asyncio.to_thread(
                lambda: t.history(start=start.isoformat(), end=end.isoformat())
            )
            if df is not None and not df.empty:
                ohlc = df.reset_index()
                ohlc = ohlc.rename(columns={
                    "Date": "date", "Datetime": "date",
                    "Open": "open", "High": "high", "Low": "low",
                    "Close": "close", "Volume": "volume",
                })
        except Exception as e:
            print(f"yfinance chart fallback error for {ticker}: {e}")
            traceback.print_exc()

    if ohlc is None or ohlc.empty:
        raise HTTPException(status_code=404, detail=f"No chart data for {ticker}")

    candles = []
    try:
        for _, row in ohlc.iterrows():
            ts = row.get("date") if hasattr(row, "get") else row["date"]
            if hasattr(ts, "timestamp"):
                t = int(ts.timestamp())
            elif hasattr(ts, "value"):
                t = int(ts.value // 10**9)
            else:
                t = int(ts)
            candles.append({
                "time": t,
                "open": round(float(row["open"]), 2),
                "high": round(float(row["high"]), 2),
                "low": round(float(row["low"]), 2),
                "close": round(float(row["close"]), 2),
                "volume": int(row["volume"]),
            })
    except Exception as e:
        print(f"Chart data processing error for {ticker}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to process chart data for {ticker}")

    if not candles:
        raise HTTPException(status_code=404, detail=f"No chart data for {ticker}")

    return {"candles": candles, "resolution": resolution}


@router.get("/{ticker}/quote")
async def get_stock_quote(ticker: str):
    provider = get_active_provider()

    from ..services.market_data import FyersProvider
    if isinstance(provider, FyersProvider):
        from ..services.nse_master import get_fyers_symbol
        symbol = get_fyers_symbol(ticker) or f"NSE:{ticker}-EQ"
        try:
            resp = await asyncio.to_thread(
                provider._fyers.quotes, data={"symbols": symbol}
            )
            if resp.get("s") == "ok" and resp.get("d"):
                v = resp["d"][0]["v"]
                return {
                    "ticker": ticker,
                    "last_price": v.get("lp"),
                    "change": v.get("ch"),
                    "change_pct": v.get("chp"),
                    "open": v.get("open_price"),
                    "high": v.get("high_price"),
                    "low": v.get("low_price"),
                    "prev_close": v.get("prev_close_price"),
                    "volume": v.get("volume"),
                    "high_52w": v.get("high_52w") if "high_52w" in v else None,
                    "low_52w": v.get("low_52w") if "low_52w" in v else None,
                }
        except Exception as e:
            print(f"Fyers quote error for {ticker}: {e}")

    # yfinance fallback
    import yfinance as yf

    symbol = f"{ticker}.NS"
    try:
        t = await asyncio.to_thread(lambda: yf.Ticker(symbol))
        fi = await asyncio.to_thread(lambda: t.fast_info)
        price = fi.last_price
        if price is None:
            raise HTTPException(status_code=404, detail=f"No quote for {ticker}")
        prev = fi.previous_close
        change = round(price - prev, 2) if prev else None
        change_pct = round((price - prev) / prev * 100, 2) if prev else None
        return {
            "ticker": ticker,
            "last_price": round(price, 2),
            "change": change,
            "change_pct": change_pct,
            "open": round(fi.open, 2) if fi.open else None,
            "high": round(fi.day_high, 2) if fi.day_high else None,
            "low": round(fi.day_low, 2) if fi.day_low else None,
            "prev_close": round(prev, 2) if prev else None,
            "volume": int(fi.last_volume) if fi.last_volume else None,
            "high_52w": round(fi.year_high, 2) if fi.year_high else None,
            "low_52w": round(fi.year_low, 2) if fi.year_low else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"yfinance quote error for {ticker}: {e}")
        raise HTTPException(status_code=404, detail=f"No quote for {ticker}")


@router.get("/{ticker}/depth")
async def get_market_depth(ticker: str):
    provider = get_active_provider()

    from ..services.market_data import FyersProvider
    if not isinstance(provider, FyersProvider):
        raise HTTPException(status_code=501, detail="Market depth requires Fyers")

    from ..services.nse_master import get_fyers_symbol
    symbol = get_fyers_symbol(ticker) or f"NSE:{ticker}-EQ"
    try:
        resp = await asyncio.to_thread(
            provider._fyers.depth, data={"symbol": symbol, "ohlcv_flag": "1"}
        )
        if resp.get("s") != "ok" or not resp.get("d"):
            raise HTTPException(status_code=404, detail="No depth data")

        d = resp["d"].get(symbol, resp["d"])
        return d
    except HTTPException:
        raise
    except Exception as e:
        print(f"Fyers depth error for {ticker}: {e}")
        raise HTTPException(status_code=500, detail="Depth fetch failed")
