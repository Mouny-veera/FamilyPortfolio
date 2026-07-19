from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Member
from ..schemas import MemberOut, MemberCreateRequest, MemberUpdateRequest

router = APIRouter(prefix="/api/members", tags=["members"])


@router.get("", response_model=list[MemberOut])
async def list_members(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Member).order_by(Member.id))
    return result.scalars().all()


@router.get("/{member_id}", response_model=MemberOut)
async def get_member(member_id: int, db: AsyncSession = Depends(get_db)):
    member = await db.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@router.post("", response_model=MemberOut)
async def create_member(req: MemberCreateRequest, db: AsyncSession = Depends(get_db)):
    name = req.name.strip()
    existing = await db.execute(select(Member).where(Member.name == name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A member with this name already exists")
    member = Member(name=name)
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


@router.put("/{member_id}", response_model=MemberOut)
async def update_member(member_id: int, req: MemberUpdateRequest, db: AsyncSession = Depends(get_db)):
    member = await db.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    name = req.name.strip()
    existing = await db.execute(select(Member).where(Member.name == name, Member.id != member_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A member with this name already exists")
    member.name = name
    await db.commit()
    await db.refresh(member)
    return member


@router.delete("/{member_id}")
async def delete_member(member_id: int, db: AsyncSession = Depends(get_db)):
    member = await db.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    await db.delete(member)
    await db.commit()
    return {"status": "deleted", "id": member_id, "name": member.name}
