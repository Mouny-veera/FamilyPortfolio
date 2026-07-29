import asyncio
import sqlite3
import subprocess
from datetime import datetime, time, timedelta, timezone
from pathlib import Path

IST = timezone(timedelta(hours=5, minutes=30))
GCS_BUCKET = "gs://familyportfolio-backups"

DB_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"
DB_PATH = DB_DIR / "portfolio.db"
BACKUP_DIR = DB_DIR / "backups"

_scheduler_task: asyncio.Task | None = None

BACKUP_TIMES = [time(6, 0), time(12, 0), time(18, 0), time(23, 30)]


def _local_backup() -> Path | None:
    if not DB_PATH.exists():
        return None
    stamp = datetime.now(IST).strftime("%Y%m%d_%H%M%S")
    dest = BACKUP_DIR / f"portfolio_{stamp}.db"
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    src_conn = sqlite3.connect(str(DB_PATH))
    dst_conn = sqlite3.connect(str(dest))
    src_conn.backup(dst_conn)
    dst_conn.close()
    src_conn.close()
    print(f"[Backup] Local backup: {dest.name}")
    return dest


def _upload_to_gcs(local_path: Path) -> bool:
    gcs_path = f"{GCS_BUCKET}/{local_path.name}"
    try:
        result = subprocess.run(
            ["gsutil", "cp", str(local_path), gcs_path],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode == 0:
            print(f"[Backup] Uploaded to GCS: {gcs_path}")
            return True
        else:
            print(f"[Backup] GCS upload failed: {result.stderr.strip()}")
            return False
    except FileNotFoundError:
        print("[Backup] gsutil not found — skipping GCS upload")
        return False
    except subprocess.TimeoutExpired:
        print("[Backup] GCS upload timed out")
        return False
    except Exception as e:
        print(f"[Backup] GCS upload error: {e}")
        return False


def _cleanup_gcs(max_remote: int = 20):
    try:
        result = subprocess.run(
            ["gsutil", "ls", "-l", f"{GCS_BUCKET}/portfolio_*.db"],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            return

        lines = [l.strip() for l in result.stdout.strip().split("\n") if l.strip() and "TOTAL:" not in l]
        if len(lines) <= max_remote:
            return

        files = []
        for line in lines:
            parts = line.split()
            if len(parts) >= 3:
                files.append(parts[-1])

        files.sort()
        to_delete = files[:len(files) - max_remote]
        for f in to_delete:
            subprocess.run(["gsutil", "rm", f], capture_output=True, timeout=30)
            print(f"[Backup] Removed old GCS backup: {f.split('/')[-1]}")
    except Exception as e:
        print(f"[Backup] GCS cleanup error: {e}")


def _cleanup_local(max_local: int = 10):
    backups = sorted(BACKUP_DIR.glob("portfolio_*.db"), key=lambda p: p.stat().st_mtime)
    while len(backups) > max_local:
        old = backups.pop(0)
        old.unlink()
        print(f"[Backup] Removed old local backup: {old.name}")


def run_backup_cycle():
    dest = _local_backup()
    if not dest:
        return
    _upload_to_gcs(dest)
    _cleanup_local()
    _cleanup_gcs()


def _next_backup_datetime() -> datetime:
    now = datetime.now(IST)
    today_times = [datetime.combine(now.date(), t, tzinfo=IST) for t in BACKUP_TIMES]

    for target in today_times:
        if now < target:
            return target

    tomorrow = now.date() + timedelta(days=1)
    return datetime.combine(tomorrow, BACKUP_TIMES[0], tzinfo=IST)


async def _scheduler_loop():
    await asyncio.sleep(10)
    print("[Backup] Running startup backup...")
    await asyncio.to_thread(run_backup_cycle)

    while True:
        target = _next_backup_datetime()
        now = datetime.now(IST)
        delay = (target - now).total_seconds()
        print(f"[Backup] Next backup at {target.strftime('%Y-%m-%d %H:%M IST')} ({delay/3600:.1f}h)")

        await asyncio.sleep(delay)
        await asyncio.to_thread(run_backup_cycle)
        await asyncio.sleep(60)


def _on_scheduler_done(t: asyncio.Task):
    global _scheduler_task
    if t.cancelled():
        return
    exc = t.exception()
    if exc:
        print(f"[Backup] Scheduler crashed: {exc}, restarting in 30s...")
        loop = asyncio.get_event_loop()
        loop.call_later(30, start_backup_scheduler)


def start_backup_scheduler():
    global _scheduler_task
    if _scheduler_task is not None and not _scheduler_task.done():
        return
    _scheduler_task = asyncio.create_task(_scheduler_loop())
    _scheduler_task.add_done_callback(_on_scheduler_done)
    print("[Backup] Scheduler started (4x daily + GCS upload)")


def stop_backup_scheduler():
    global _scheduler_task
    if _scheduler_task is not None:
        _scheduler_task.cancel()
        _scheduler_task = None
        print("[Backup] Scheduler stopped")
