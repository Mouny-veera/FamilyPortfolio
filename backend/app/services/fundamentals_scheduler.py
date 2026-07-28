import asyncio
from datetime import datetime, time, timedelta, timezone

from .fundamentals import refresh_all_fundamentals, is_data_stale

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
            print("[Fundamentals] Data is stale, fetching on startup...")
            await refresh_all_fundamentals()
        else:
            print("[Fundamentals] Data is fresh, skipping startup fetch")
    except Exception as e:
        print(f"[Fundamentals] Startup check error: {e}")


async def _scheduler_loop():
    await asyncio.sleep(30)
    await _run_if_stale()

    while True:
        target = _next_fetch_datetime()
        now = datetime.now(IST)
        delay = (target - now).total_seconds()
        print(f"[Fundamentals] Next fetch at {target.strftime('%Y-%m-%d %H:%M IST')} ({delay/3600:.1f}h)")

        await asyncio.sleep(delay)
        print(f"[Fundamentals] Starting scheduled fetch at {datetime.now(IST).strftime('%H:%M IST')}")

        try:
            await refresh_all_fundamentals()
        except Exception as e:
            print(f"[Fundamentals] Scheduled fetch error: {e}")

        await asyncio.sleep(60)


def start_fundamentals_scheduler():
    global _scheduler_task
    if _scheduler_task is not None:
        return
    _scheduler_task = asyncio.create_task(_scheduler_loop())
    _scheduler_task.add_done_callback(
        lambda t: print(f"[Fundamentals] Scheduler stopped: {t.exception()}")
        if not t.cancelled() and t.exception() else None
    )
    print("[Fundamentals] Scheduler started")


def stop_fundamentals_scheduler():
    global _scheduler_task
    if _scheduler_task is not None:
        _scheduler_task.cancel()
        _scheduler_task = None
        print("[Fundamentals] Scheduler stopped")
