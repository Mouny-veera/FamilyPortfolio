from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Member
from ..schemas import MemberOut

router = APIRouter(prefix="/api/members", tags=["members"])


@router.get("", response_model=list[MemberOut])
async def list_members(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Member).order_by(Member.id))
    return result.scalars().all()


@router.get("/{member_id}", response_model=MemberOut)
async def get_member(member_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Member).where(Member.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Member not found")
    return member
