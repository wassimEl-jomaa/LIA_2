from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from .db import get_db
from .models import Project, User, Organization
from .schemas import ProjectCreateIn, ProjectOut, UserMeOut
from .auth import get_current_user

router = APIRouter(prefix="/api/projects", tags=["projects"])

@router.post("", response_model=ProjectOut)
async def create_project(
    payload: ProjectCreateIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # per-user uniqueness (recommended) OR global uniqueness
    stmt = select(Project).where(Project.name == payload.name, Project.owner_user_id == user.id)
    existing = (await db.execute(stmt)).scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Project already exists")

    # If organization name is provided, look up the organization ID
    organization_id = None
    if payload.organization:
        org_stmt = select(Organization).where(Organization.name == payload.organization)
        org = (await db.execute(org_stmt)).scalars().first()
        if org:
            organization_id = org.id

    p = Project(
        name=payload.name,
        description=payload.description,
        organization_id=organization_id,
        owner_user_id=user.id
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)

    return ProjectOut(
        id=p.id,
        name=p.name,
        description=p.description,
        organization_id=p.organization_id,
        owner_user_id=p.owner_user_id,
        created_at=str(p.created_at)
    )

@router.get("", response_model=list[ProjectOut])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (await db.execute(select(Project).where(Project.owner_user_id == user.id))).scalars().all()
    return [
        ProjectOut(
            id=r.id,
            name=r.name,
            description=r.description,
            organization_id=r.organization_id,
            owner_user_id=r.owner_user_id,
            created_at=str(r.created_at)
        )
        for r in rows
    ]

@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Project).where(Project.id == project_id, Project.owner_user_id == user.id)
    project = (await db.execute(stmt)).scalars().first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description,
        organization_id=project.organization_id,
        owner_user_id=project.owner_user_id,
        created_at=str(project.created_at)
    )

@router.get("/auth/me", response_model=UserMeOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserMeOut(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role_id=current_user.role_id,
        organization_id=current_user.organization_id,
        created_at=str(current_user.created_at),
    )