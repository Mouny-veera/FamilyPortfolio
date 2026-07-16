from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..services.nse_master import (
    refresh_nse_master_list,
    search_nse_stocks,
    get_mapping_status,
    remap_ticker,
)

router = APIRouter(prefix="/api/nse", tags=["nse"])


@router.get("/search")
async def search(q: str = Query(..., min_length=1)):
    return search_nse_stocks(q, limit=10)


@router.post("/refresh-master")
async def refresh_master():
    result = await refresh_nse_master_list()
    return result


@router.get("/mapping-status")
async def mapping_status(db: AsyncSession = Depends(get_db)):
    return await get_mapping_status(db)


@router.post("/remap")
async def remap(
    old_ticker: str = Query(...),
    new_ticker: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    new_upper = new_ticker.upper().strip()
    old_upper = old_ticker.upper().strip()
    if old_upper == new_upper:
        raise HTTPException(400, "Old and new ticker are the same")
    result = await remap_ticker(db, old_upper, new_upper)
    return result
