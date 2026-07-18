import asyncio
from datetime import datetime, timezone, timedelta

from sqlalchemy import select

from ..database import async_session
from ..models import Lot, PriceCache
from .market_data import get_active_provider, load_config

_polling_task: asyncio.Task | None = None
_scan_task: asyncio.Task | None = None
_consecutive_failures: int = 0

_IST = timezone(timedelta(hours=5, minutes=30))


def _is_market_hours() -> bool:
    now_ist = datetime.now(_IST)
    if now_ist.weekday() >= 5:
        return False
    hour_min = now_ist.hour * 100 + now_ist.minute
    return 915 <= hour_min <= 1530


async def refresh_prices():
    async with async_session() as db:
        result = await db.execute(select(Lot.ticker).distinct())
        tickers = [r[0] for r in result.all()]

    if not tickers:
        return {"updated": 0, "total_tickers": 0}

    provider = get_active_provider()
    prices = await provider.get_bulk_prices(tickers)
    now = datetime.now(timezone.utc)
    updated = 0

    async with async_session() as db:
        for ticker, data in prices.items():
            existing = await db.get(PriceCache, ticker)
            if existing:
                existing.last_price = data["last_price"]
                existing.change_pct = data["change_pct"]
                existing.updated_at = now
            else:
                db.add(PriceCache(
                    ticker=ticker,
                    last_price=data["last_price"],
                    change_pct=data["change_pct"],
                    updated_at=now,
                ))
            updated += 1
        await db.commit()

    return {"updated": updated, "total_tickers": len(tickers), "tickers": list(prices.keys())}


async def _polling_loop():
    global _consecutive_failures
    while True:
        if _is_market_hours():
            try:
                result = await refresh_prices()
                if result.get("updated", 0) > 0:
                    _consecutive_failures = 0
                else:
                    _consecutive_failures += 1
            except Exception:
                _consecutive_failures += 1
                import traceback
                traceback.print_exc()

            if _consecutive_failures >= 2 and _has_fyers_auto_login():
                print(f"Price refresh failed {_consecutive_failures} times, attempting Fyers token refresh...")
                try:
                    from .fyers_auth import ensure_valid_token
                    refreshed = await ensure_valid_token()
                    if refreshed:
                        _consecutive_failures = 0
                        result = await refresh_prices()
                        if result.get("updated", 0) > 0:
                            print(f"Token refresh succeeded, updated {result['updated']} prices")
                        else:
                            print("Token refreshed but price fetch still returned 0")
                    else:
                        print("Fyers token refresh failed — will retry next cycle")
                except Exception as e:
                    print(f"Token refresh error: {e}")
        await asyncio.sleep(60)


async def _scan_loop():
    while True:
        if _is_market_hours():
            try:
                from ..scanner.engine import run_scan
                results = await run_scan()
                print(f"Auto-scan completed: {len(results)} results")
            except Exception as e:
                print(f"Auto-scan error: {e}")
        await asyncio.sleep(3600)


def _has_fyers_auto_login() -> bool:
    config = load_config()
    fyers = config.get("fyers", {})
    return bool(fyers.get("totp_secret") and fyers.get("fy_id") and fyers.get("pin"))


def start_polling():
    global _polling_task, _scan_task
    if _polling_task is None or _polling_task.done():
        _polling_task = asyncio.create_task(_polling_loop())
    if _scan_task is None or _scan_task.done():
        _scan_task = asyncio.create_task(_scan_loop())


def stop_polling():
    global _polling_task, _scan_task
    if _polling_task and not _polling_task.done():
        _polling_task.cancel()
        _polling_task = None
    if _scan_task and not _scan_task.done():
        _scan_task.cancel()
        _scan_task = None
