from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from .db import get_db
from .auth import get_current_user
from .models import Group, GroupMember, User
from .schemas import GroupCreateIn, GroupOut, GroupMemberAddIn

router = APIRouter(prefix="/api/groups", tags=["groups"])

@router.post("", response_model=GroupOut)
async def create_group(payload: GroupCreateIn, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    if not user.organization_id:
        raise HTTPException(status_code=400, detail="User has no organization")

    g = Group(name=payload.name, organization_id=user.organization_id)
    db.add(g)
    await db.commit()
    await db.refresh(g)
    return GroupOut(id=g.id, organization_id=g.organization_id, name=g.name, created_at=str(g.created_at))

@router.get("", response_model=list[GroupOut])
async def list_groups(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = select(Group).where(Group.organization_id == user.organization_id).order_by(Group.name.asc())
    rows = (await db.execute(stmt)).scalars().all()
    return [GroupOut(id=r.id, organization_id=r.organization_id, name=r.name, created_at=str(r.created_at)) for r in rows]

@router.get("/{group_id}/members")
async def list_group_members(group_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    grp = (await db.execute(select(Group).where(Group.id == group_id))).scalars().first()
    if not grp or grp.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Group not found")

    stmt = (
        select(GroupMember)
        .where(GroupMember.group_id == group_id)
        .options(selectinload(GroupMember.user))
    )
    members = (await db.execute(stmt)).scalars().all()
    return [{"id": m.id, "group_id": m.group_id, "user_id": m.user_id} for m in members]

@router.post("/{group_id}/members")
async def add_member(group_id: int, payload: GroupMemberAddIn, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    grp = (await db.execute(select(Group).where(Group.id == group_id))).scalars().first()
    if not grp or grp.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Group not found")

    member_user = (await db.execute(select(User).where(User.id == payload.user_id))).scalars().first()
    if not member_user or member_user.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="User not found in same organization")

    db.add(GroupMember(group_id=group_id, user_id=payload.user_id))
    await db.commit()
    return {"status": "added", "group_id": group_id, "user_id": payload.user_id}

@router.delete("/{group_id}/members/{user_id}")
async def remove_member(group_id: int, user_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    grp = (await db.execute(select(Group).where(Group.id == group_id))).scalars().first()
    if not grp or grp.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Group not found")

    await db.execute(delete(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user_id))
    await db.commit()
    return {"status": "removed", "group_id": group_id, "user_id": user_id}
