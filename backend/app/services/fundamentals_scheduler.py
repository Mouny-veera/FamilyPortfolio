import asyncio
from datetime import datetime, time, timedelta, timezone

from .fundamentals import refresh_all_fundamentals, is_data_stale

import logging
logger = logging.getLogger(__name__)

IST = timezone(timedelta(hours=5, minutes=30))
FETCH_TIME = time(6, 0)

_scheduler_task: asyncio.Task | None = None


def _next_fetch_datetime() -> datetime:
    now = datetime.now(IST)
    target = datetime.combine(now.date(), FETCH_TIME, tzinfo=IST)
    if now >= target:
        target += timedelta(days=1)
    return target


async def _run_if_stale():
    try:
        stale = await is_data_stale()
        if stale:
            logger.info("[Fundamentals] Data is stale, fetching on startup...")
            await refresh_all_fundamentals()
        else:
            logger.warning("[Fundamentals] Data is fresh, skipping startup fetch")
    except Exception as e:
        logger.error("[Fundamentals] Startup check error: %s", e)


async def _scheduler_loop():
    await asyncio.sleep(30)
    await _run_if_stale()

    while True:
        target = _next_fetch_datetime()
        now = datetime.now(IST)
        delay = (target - now).total_seconds()
        logger.info("[Fundamentals] Next fetch at %s (%.1fh)", target.strftime('%Y-%m-%d %H:%M'), delay / 3600)

        await asyncio.sleep(delay)
        logger.info("[Fundamentals] Starting scheduled fetch at %s", datetime.now(IST).strftime('%H:%M'))

        try:
            await refresh_all_fundamentals()
        except Exception as e:
            logger.error("[Fundamentals] Scheduled fetch error: %s", e)

        await asyncio.sleep(60)


def _on_scheduler_done(t: asyncio.Task):
    global _scheduler_task
    if t.cancelled():
        return
    exc = t.exception()
    if exc:
        logger.error("[Fundamentals] Scheduler crashed: %s, restarting in 30s...", exc)
        loop = asyncio.get_event_loop()
        loop.call_later(30, start_fundamentals_scheduler)


def start_fundamentals_scheduler():
    global _scheduler_task
    if _scheduler_task is not None and not _scheduler_task.done():
        return
    _scheduler_task = asyncio.create_task(_scheduler_loop())
    _scheduler_task.add_done_callback(_on_scheduler_done)
    logger.info("[Fundamentals] Scheduler started")


def stop_fundamentals_scheduler():
    global _scheduler_task
    if _scheduler_task is not None:
        _scheduler_task.cancel()
        _scheduler_task = None
        logger.info("[Fundamentals] Scheduler stopped")
