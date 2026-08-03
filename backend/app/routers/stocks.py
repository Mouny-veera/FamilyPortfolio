import asyncio
import traceback
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query

from ..auth import quote_limiter, chart_limiter
from ..services.market_data import get_active_provider

import logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stocks", tags=["stocks"])

RANGE_DAYS = {
    "1D": 1, "5D": 5, "1M": 30, "3M": 90,
    "6M": 180, "1Y": 365, "5Y": 1825, "ALL": 15000,
}

VALID_RESOLUTIONS = {"1", "5", "15", "30", "60", "120", "D", "W", "M"}

INTRADAY_RESOLUTIONS = {"1", "5", "15", "30", "60", "120"}

RANGE_DEFAULT_RESOLUTION = {
    "1D": "5", "5D": "15", "1M": "30", "3M": "60",
    "6M": "120", "1Y": "D", "5Y": "W", "ALL": "M",
}


def _resample_ohlcv(candles: list[dict], rule: str) -> list[dict]:
    if not candles:
        return candles
    import pandas as pd
    df = pd.DataFrame(candles)
    df["dt"] = pd.to_datetime(df["time"], unit="s")
    df = df.set_index("dt")
    resampled = df.resample(rule).agg({
        "open": "first", "high": "max", "low": "min",
        "close": "last", "volume": "sum", "time": "last",
    }).dropna(subset=["open"])
    return [
        {"time": int(r["time"]), "open": round(r["open"], 2), "high": round(r["high"], 2),
         "low": round(r["low"], 2), "close": round(r["close"], 2), "volume": int(r["volume"])}
        for _, r in resampled.iterrows()
    ]


@router.get("/{ticker}/chart")
async def get_stock_chart(
    ticker: str,
    resolution: str = Query("D", pattern="^(1|5|15|30|60|120|D|W|M)$"),
    range: str = Query("6M", pattern="^(1D|5D|1M|3M|6M|1Y|5Y|ALL)$"),
):
    chart_limiter.check()
    if resolution not in VALID_RESOLUTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid resolution: {resolution}")
    days = RANGE_DAYS[range]

    is_intraday = resolution in INTRADAY_RESOLUTIONS
    fyers_resolution = resolution

    provider = get_active_provider()

    end = date.today()
    start = end - timedelta(days=days)

    from ..services.market_data import FyersProvider
    if isinstance(provider, FyersProvider) and is_intraday:
        from ..services.nse_master import get_fyers_symbol
        symbol = get_fyers_symbol(ticker) or f"NSE:{ticker}-EQ"
        data = {
            "symbol": symbol,
            "resolution": fyers_resolution,
            "date_format": "1",
            "range_from": start.isoformat(),
            "range_to": end.isoformat(),
            "cont_flag": "1",
        }
        try:
            resp = await asyncio.to_thread(provider._fyers.history, data=data)
            candles = resp.get("candles")
            if candles:
                clean = []
                for c in candles:
                    if any(c[i] != c[i] for i in range(1, 5)):
                        continue
                    vol = c[5]
                    clean.append({
                        "time": int(c[0]) if isinstance(c[0], (int, float)) else c[0],
                        "open": round(c[1], 2),
                        "high": round(c[2], 2),
                        "low": round(c[3], 2),
                        "close": round(c[4], 2),
                        "volume": int(vol) if vol == vol else 0,
                    })
                if clean:
                    return {"candles": clean, "resolution": fyers_resolution}
        except Exception as e:
            logger.error("Fyers intraday error for %s: %s", ticker, e)

    try:
        ohlc = await provider.get_historical_ohlc(ticker, start, end)
    except Exception as e:
        logger.error("Chart historical OHLC error for %s: %s", ticker, e)
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
            logger.error("yfinance chart fallback error for %s: %s", ticker, e)
            traceback.print_exc()

    if ohlc is None or ohlc.empty:
        raise HTTPException(status_code=404, detail=f"No chart data for {ticker}")

    ohlc = ohlc.dropna(subset=["open", "high", "low", "close"])
    if ohlc.empty:
        raise HTTPException(status_code=404, detail=f"No valid chart data for {ticker}")

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
            vol = row["volume"]
            candles.append({
                "time": t,
                "open": round(float(row["open"]), 2),
                "high": round(float(row["high"]), 2),
                "low": round(float(row["low"]), 2),
                "close": round(float(row["close"]), 2),
                "volume": int(vol) if vol == vol else 0,
            })
    except Exception as e:
        logger.error("Chart data processing error for %s: %s", ticker, e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to process chart data for {ticker}")

    if not candles:
        raise HTTPException(status_code=404, detail=f"No chart data for {ticker}")

    if resolution == "W":
        candles = _resample_ohlcv(candles, "W-FRI")
    elif resolution == "M":
        candles = _resample_ohlcv(candles, "ME")

    return {"candles": candles, "resolution": resolution}


@router.get("/{ticker}/quote")
async def get_stock_quote(ticker: str):
    quote_limiter.check()
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
            logger.error("Fyers quote error for %s: %s", ticker, e)

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
        logger.error("yfinance quote error for %s: %s", ticker, e)
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
        logger.error("Fyers depth error for %s: %s", ticker, e)
        raise HTTPException(status_code=500, detail="Depth fetch failed")
