from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import scanner_limiter
from ..database import get_db
from ..models import ScanResult
from ..schemas import ScanResultOut

router = APIRouter(prefix="/api/scanner", tags=["scanner"])


@router.get("/results", response_model=list[ScanResultOut])
async def get_scan_results(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ScanResult).order_by(ScanResult.score.desc())
    )
    return result.scalars().all()


@router.post("/run")
async def run_scanner(db: AsyncSession = Depends(get_db)):
    scanner_limiter.check()
    from ..scanner.engine import run_scan
    try:
        results = await run_scan()
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {"status": "completed", "results_count": len(results)}
