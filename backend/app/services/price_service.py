import asyncio
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import async_session
from ..models import Lot, PriceCache
from .market_data import get_active_provider
_polling_task: asyncio.Task | None = None

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
        return {"updated": 0}

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

    return {"updated": updated, "tickers": list(prices.keys())}


async def _polling_loop():
    while True:
        if _is_market_hours():
            try:
                await refresh_prices()
            except Exception as e:
                import traceback
                traceback.print_exc()
        await asyncio.sleep(60)


def start_polling():
    global _polling_task
    if _polling_task is None or _polling_task.done():
        _polling_task = asyncio.create_task(_polling_loop())


def stop_polling():
    global _polling_task
    if _polling_task and not _polling_task.done():
        _polling_task.cancel()
        _polling_task = None
