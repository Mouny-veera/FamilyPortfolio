import asyncio
from datetime import datetime, time, timedelta, timezone

from .market_data import load_config, save_config

IST = timezone(timedelta(hours=5, minutes=30))
SCAN_TIME = time(15, 45)

_scheduler_task: asyncio.Task | None = None


def is_auto_scan_enabled() -> bool:
    config = load_config()
    return config.get("auto_scan", {}).get("enabled", True)


def set_auto_scan_enabled(enabled: bool):
    config = load_config()
    if "auto_scan" not in config:
        config["auto_scan"] = {}
    config["auto_scan"]["enabled"] = enabled
    save_config(config)


def get_auto_scan_status() -> dict:
    config = load_config()
    auto_scan = config.get("auto_scan", {})
    return {
        "enabled": auto_scan.get("enabled", True),
        "scan_time": "15:45 IST",
        "last_auto_scan": auto_scan.get("last_auto_scan"),
        "next_scan": _next_scan_time_str(),
    }


def _next_scan_time_str() -> str | None:
    if not is_auto_scan_enabled():
        return None
    nxt = _next_scan_datetime()
    return nxt.strftime("%Y-%m-%d %H:%M IST")


def _next_scan_datetime() -> datetime:
    now = datetime.now(IST)
    target = datetime.combine(now.date(), SCAN_TIME, tzinfo=IST)

    if now >= target:
        target += timedelta(days=1)

    # Skip weekends (Saturday=5, Sunday=6)
    while target.weekday() >= 5:
        target += timedelta(days=1)

    return target


def _seconds_until_next_scan() -> float:
    now = datetime.now(IST)
    target = _next_scan_datetime()
    return (target - now).total_seconds()


async def _run_scheduled_scan():
    from ..scanner.engine import run_scan

    config = load_config()
    last = config.get("auto_scan", {}).get("last_auto_scan")
    today = datetime.now(IST).strftime("%Y-%m-%d")
    if last == today:
        print(f"[AutoScan] Already ran today ({today}), skipping")
        return

    print(f"[AutoScan] Starting scheduled scan at {datetime.now(IST).strftime('%H:%M IST')}")
    try:
        results = await run_scan()
        print(f"[AutoScan] Completed — {len(results)} results")

        config = load_config()
        if "auto_scan" not in config:
            config["auto_scan"] = {}
        config["auto_scan"]["last_auto_scan"] = today
        save_config(config)
    except RuntimeError as e:
        print(f"[AutoScan] Skipped — {e}")
    except Exception as e:
        print(f"[AutoScan] Error — {e}")


async def _scheduler_loop():
    while True:
        if not is_auto_scan_enabled():
            await asyncio.sleep(60)
            continue

        delay = _seconds_until_next_scan()
        now = datetime.now(IST)
        target = _next_scan_datetime()
        print(f"[AutoScan] Next scan at {target.strftime('%Y-%m-%d %H:%M IST')} ({delay/3600:.1f}h from now)")

        await asyncio.sleep(delay)

        if is_auto_scan_enabled():
            await _run_scheduled_scan()

        # Brief pause before recalculating next run
        await asyncio.sleep(60)


def start_scan_scheduler():
    global _scheduler_task
    if _scheduler_task is not None:
        return
    _scheduler_task = asyncio.create_task(_scheduler_loop())
    _scheduler_task.add_done_callback(
        lambda t: print(f"[AutoScan] Scheduler stopped: {t.exception()}")
        if not t.cancelled() and t.exception() else None
    )
    print("[AutoScan] Scheduler started")


def stop_scan_scheduler():
    global _scheduler_task
    if _scheduler_task is not None:
        _scheduler_task.cancel()
        _scheduler_task = None
        print("[AutoScan] Scheduler stopped")
