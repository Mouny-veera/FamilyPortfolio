import asyncio
import traceback
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import scanner_limiter
from ..database import get_db
from ..models import ScanResult
from ..schemas import ScanResultOut

router = APIRouter(prefix="/api/scanner", tags=["scanner"])

_scan_status: dict = {"running": False, "progress": 0, "total": 0, "error": None, "started_at": None}


def _get_status() -> dict:
    return {**_scan_status}


async def _run_scan_background():
    from ..scanner.engine import run_scan
    _scan_status["running"] = True
    _scan_status["error"] = None
    _scan_status["started_at"] = datetime.now(timezone.utc).isoformat()
    try:
        await run_scan()
    except Exception as e:
        traceback.print_exc()
        _scan_status["error"] = str(e)
    finally:
        _scan_status["running"] = False


@router.get("/results", response_model=list[ScanResultOut])
async def get_scan_results(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ScanResult).order_by(ScanResult.score.desc())
    )
    return result.scalars().all()


@router.post("/run")
async def run_scanner():
    if _scan_status["running"]:
        raise HTTPException(status_code=409, detail="A scan is already in progress")
    scanner_limiter.check()
    asyncio.create_task(_run_scan_background())
    return {"status": "started"}


@router.get("/status")
async def scan_status():
    return _get_status()
