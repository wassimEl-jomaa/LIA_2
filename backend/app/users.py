from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from .db import get_db
from .models import User
from .schemas import UserOut, UserCreateIn, UserUpdateIn
from .security import hash_password
from .auth import get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])


def require_admin(current_user: User):
    if current_user.role_id != 1:
        raise HTTPException(status_code=403, detail="Admin only")


def to_out(u: User) -> UserOut:
    return UserOut(
        id=u.id,
        email=u.email,
        name=u.name,
        tel=u.tel,
        address=u.address,
        city=u.city,
        country=u.country,
        role_id=u.role_id,
        organization_id=u.organization_id,
        created_at=str(u.created_at),
    )


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return to_out(current_user)


@router.get("", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)
    users = (await db.execute(select(User).order_by(User.id.desc()))).scalars().all()
    return [to_out(u) for u in users]


@router.post("", response_model=UserOut)
async def create_user(
    payload: UserCreateIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    existing = (await db.execute(select(User).where(User.email == payload.email))).scalars().first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already exists")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        name=payload.name,
        tel=payload.tel,
        address=payload.address,
        city=payload.city,
        country=payload.country,
        role_id=payload.role_id,
        organization_id=payload.organization_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return to_out(user)


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    user = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return to_out(user)


@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    payload: UserUpdateIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    user = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.email and payload.email != user.email:
        exists = (await db.execute(select(User).where(User.email == payload.email))).scalars().first()
        if exists:
            raise HTTPException(status_code=409, detail="Email already exists")
        user.email = payload.email

    if payload.password:
        user.hashed_password = hash_password(payload.password)

    if payload.name is not None:
        user.name = payload.name
    if payload.tel is not None:
        user.tel = payload.tel
    if payload.address is not None:
        user.address = payload.address
    if payload.city is not None:
        user.city = payload.city
    if payload.country is not None:
        user.country = payload.country
    if payload.role_id is not None:
        user.role_id = payload.role_id
    if payload.organization_id is not None:
        user.organization_id = payload.organization_id

    await db.commit()
    await db.refresh(user)
    return to_out(user)


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete yourself")

    user = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.execute(delete(User).where(User.id == user_id))
    await db.commit()
    return {"status": "deleted", "user_id": user_id}
