from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError

from .db import get_db
from .auth import get_current_user
from .models import Organization, User
from .schemas import (
    OrganizationCreateIn,
    OrganizationUpdateIn,
    OrganizationOut,
)

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


# -------------------------
# CREATE
# -------------------------
@router.post("", response_model=OrganizationOut)
async def create_organization(
    payload: OrganizationCreateIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    org = Organization(
        name=payload.name.strip(),
        org_number=payload.org_number,
        email=payload.email,
        phone=payload.phone,
        address=payload.address,
        city=payload.city,
        country=payload.country,
    )

    db.add(org)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Organization already exists")

    await db.refresh(org)
    return org


# -------------------------
# UPDATE
# -------------------------
@router.put("/{org_id}", response_model=OrganizationOut)
async def update_organization(
    org_id: int,
    payload: OrganizationUpdateIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    org = (await db.execute(
        select(Organization).where(Organization.id == org_id)
    )).scalars().first()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(org, field, value)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Organization conflict")

    await db.refresh(org)
    return org


# -------------------------
# DELETE
# -------------------------
@router.delete("/{org_id}")
async def delete_organization(
    org_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    org = (await db.execute(
        select(Organization).where(Organization.id == org_id)
    )).scalars().first()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    await db.execute(delete(Organization).where(Organization.id == org_id))
    await db.commit()

    return {"status": "deleted", "organization_id": org_id}


# -------------------------
# GET ALL
# -------------------------
@router.get("", response_model=list[OrganizationOut])
async def list_organizations(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (await db.execute(select(Organization))).scalars().all()
    return rows


# -------------------------
# GET ONE
# -------------------------
@router.get("/{org_id}", response_model=OrganizationOut)
async def get_organization(
    org_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    org = (await db.execute(
        select(Organization).where(Organization.id == org_id)
    )).scalars().first()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    return org
