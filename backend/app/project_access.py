# app/permissions.py
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Project, ProjectMember, Role


async def ensure_project_access(
    db: AsyncSession,
    project_id: int,
    user_id: int,
    allow_view: bool = True,
) -> Project:
    """
    Ensures the user has access to a project.

    Rules:
    - Owner always has access.
    - Otherwise user must exist in ProjectMember.
    - If allow_view=False, require access_level == "editor".

    Returns: Project row if allowed, otherwise raises HTTPException.
    """
    proj = (await db.execute(select(Project).where(Project.id == project_id))).scalars().first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    # Owner has full access
    if proj.owner_user_id == user_id:
        return proj

    # Not owner -> must be member
    member = (
        await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id,
            )
        )
    ).scalars().first()

    if not member:
        raise HTTPException(status_code=403, detail="No access to this project")

    # If operation requires edit permission
    if not allow_view and (member.access_level or "").lower() != "editor":
        raise HTTPException(status_code=403, detail="Not enough permissions")

    return proj


async def ensure_project_admin(
    db: AsyncSession,
    project_id: int,
    user,
) -> Project:
    """
    Ensures user can manage sharing/members for the project.

    Rules:
    - Project owner is allowed
    - OR user has admin role (role.name == "admin" OR role.is_admin == True if column exists)

    Returns: Project row if allowed, otherwise raises HTTPException.
    """
    proj = (await db.execute(select(Project).where(Project.id == project_id))).scalars().first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    # Owner ok
    if proj.owner_user_id == user.id:
        return proj

    # Avoid lazy-loading user.role in async -> query role explicitly
    if not getattr(user, "role_id", None):
        raise HTTPException(status_code=403, detail="Only owner/admin can manage sharing")

    role = (await db.execute(select(Role).where(Role.id == user.role_id))).scalars().first()
    if not role:
        raise HTTPException(status_code=403, detail="Only owner/admin can manage sharing")

    # Support both patterns:
    # - role.name == "admin"
    # - role.is_admin == True (if you added it)
    is_admin = False
    if getattr(role, "name", None) and role.name == "admin":
        is_admin = True
    if hasattr(role, "is_admin") and bool(getattr(role, "is_admin")):
        is_admin = True

    if not is_admin:
        raise HTTPException(status_code=403, detail="Only owner/admin can manage sharing")

    return proj
