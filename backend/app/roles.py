from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from .db import get_db
from .models import Role, User
from .schemas import RoleCreateIn, RoleUpdateIn, RoleOut
from .auth import get_current_user

router = APIRouter(prefix="/api/roles", tags=["roles"])


# ---- Optional: Admin guard (rekommenderas) ----
def require_admin(user: User):
    # om role saknas => inte admin
    if not user.role or not user.role.is_admin:
        raise HTTPException(status_code=403, detail="Admin role required")


@router.get("", response_model=list[RoleOut])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)
    rows = (await db.execute(select(Role).order_by(Role.id))).scalars().all()
    return [RoleOut(id=r.id, name=r.name, is_admin=r.is_admin) for r in rows]


@router.post("", response_model=RoleOut)
async def create_role(
    payload: RoleCreateIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)

    existing = (await db.execute(select(Role).where(Role.name == payload.name))).scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Role name already exists")

    role = Role(name=payload.name, is_admin=payload.is_admin)
    db.add(role)
    await db.commit()
    await db.refresh(role)

    return RoleOut(id=role.id, name=role.name, is_admin=role.is_admin)


@router.put("/{role_id}", response_model=RoleOut)
async def update_role(
    role_id: int,
    payload: RoleUpdateIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)

    role = (await db.execute(select(Role).where(Role.id == role_id))).scalars().first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    # name unique check
    if payload.name and payload.name != role.name:
        exists = (await db.execute(select(Role).where(Role.name == payload.name))).scalars().first()
        if exists:
            raise HTTPException(status_code=400, detail="Role name already exists")
        role.name = payload.name

    if payload.is_admin is not None:
        role.is_admin = payload.is_admin

    await db.commit()
    await db.refresh(role)
    return RoleOut(id=role.id, name=role.name, is_admin=role.is_admin)


@router.delete("/{role_id}")
async def delete_role(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)

    role = (await db.execute(select(Role).where(Role.id == role_id))).scalars().first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    # (valfritt) blockera delete om role används
    used = (await db.execute(select(User).where(User.role_id == role_id).limit(1))).scalars().first()
    if used:
        raise HTTPException(status_code=400, detail="Role is in use by users")

    await db.execute(delete(Role).where(Role.id == role_id))
    await db.commit()
    return {"status": "deleted", "role_id": role_id}
