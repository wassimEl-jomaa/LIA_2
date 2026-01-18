from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from .db import get_db
from .auth import get_current_user
from .models import Project, User, ProjectMember
from .schemas import ProjectMemberAddByEmailIn, ProjectMemberOut

router = APIRouter(prefix="/api/projects", tags=["project-sharing"])

async def ensure_owner_or_admin(project: Project, user: User):
    is_owner = project.owner_user_id == user.id
    is_admin = (user.role and user.role.name == "admin")
    if not (is_owner or is_admin):
        raise HTTPException(status_code=403, detail="Only owner/admin can manage members")

@router.post("/{project_id}/members", response_model=ProjectMemberOut)
async def add_project_member(
    project_id: int,
    payload: ProjectMemberAddByEmailIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = (await db.execute(select(Project).where(Project.id == project_id))).scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await ensure_owner_or_admin(project, user)

    target = (await db.execute(select(User).where(User.email == payload.email))).scalars().first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target.organization_id != project.organization_id:
        raise HTTPException(status_code=400, detail="User is not in same organization")

    access_level = payload.access_level.lower().strip()
    if access_level not in ["viewer", "editor"]:
        raise HTTPException(status_code=400, detail="Invalid access_level (viewer|editor)")

    existing = (await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == target.id)
    )).scalars().first()

    if existing:
        existing.access_level = access_level
        await db.commit()
        await db.refresh(existing)
        return ProjectMemberOut(
            id=existing.id,
            project_id=existing.project_id,
            user_id=existing.user_id,
            access_level=existing.access_level,
            created_at=str(existing.created_at),
        )

    m = ProjectMember(project_id=project_id, user_id=target.id, access_level=access_level)
    db.add(m)
    await db.commit()
    await db.refresh(m)

    return ProjectMemberOut(
        id=m.id,
        project_id=m.project_id,
        user_id=m.user_id,
        access_level=m.access_level,
        created_at=str(m.created_at),
    )

@router.get("/{project_id}/members", response_model=list[ProjectMemberOut])
async def list_project_members(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = (await db.execute(select(Project).where(Project.id == project_id))).scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # allow owner/admin OR any member to view list (optional: restrict)
    # simplest: allow owner/admin only
    await ensure_owner_or_admin(project, user)

    rows = (await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id)
    )).scalars().all()

    return [
        ProjectMemberOut(
            id=r.id, project_id=r.project_id, user_id=r.user_id,
            access_level=r.access_level, created_at=str(r.created_at)
        )
        for r in rows
    ]

@router.delete("/{project_id}/members/{user_id}")
async def remove_project_member(
    project_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = (await db.execute(select(Project).where(Project.id == project_id))).scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await ensure_owner_or_admin(project, user)

    await db.execute(delete(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id))
    await db.commit()
    return {"status": "removed", "project_id": project_id, "user_id": user_id}
