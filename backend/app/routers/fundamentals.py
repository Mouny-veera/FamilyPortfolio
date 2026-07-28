from fastapi import APIRouter

from ..services.fundamentals import get_all_fundamentals, get_fundamentals_status

router = APIRouter(prefix="/api/fundamentals", tags=["fundamentals"])


@router.get("")
async def list_fundamentals():
    return await get_all_fundamentals()


@router.get("/status")
async def fundamentals_status():
    return await get_fundamentals_status()
