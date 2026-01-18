# app/permissions.py
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Project, ProjectMember, User


async def ensure_project_access(
    db: AsyncSession,
    project_id: int,
    user_id: int,
    allow_view: bool = True,
) -> Project:
    proj = (await db.execute(select(Project).where(Project.id == project_id))).scalars().first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    if proj.owner_user_id == user_id:
        return proj

    member = (await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )).scalars().first()

    if not member:
        raise HTTPException(status_code=403, detail="No access to this project")

    if not allow_view and member.access_level != "editor":
        raise HTTPException(status_code=403, detail="Not enough permissions")

    return proj


async def ensure_project_admin(db: AsyncSession, project_id: int, user: User) -> Project:
    proj = await ensure_project_access(db, project_id, user.id, allow_view=True)

    is_owner = proj.owner_user_id == user.id

    # choose ONE admin check that matches your DB
    is_admin = False
    if getattr(user, "role", None) and getattr(user.role, "name", None) == "admin":
        is_admin = True
    # OR: is_admin = bool(user.role and user.role.is_admin)

    if not (is_owner or is_admin):
        raise HTTPException(status_code=403, detail="Only owner/admin can manage sharing")

    return proj
