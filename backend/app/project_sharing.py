from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from .db import get_db
from .auth import get_current_user
from .models import Project, User, ProjectMember, GroupMember, Group,Role, ProjectGroupMember
from .schemas import  ProjectMemberOut, ProjectMemberOut, MemberUserOut, GroupOut, ProjectMemberUpdateIn, AddProjectMemberIn
from .project_access import ensure_project_access, ensure_project_admin
from sqlalchemy.orm import selectinload     
router = APIRouter(prefix="/api/projects", tags=["project-sharing"])

async def ensure_owner_or_admin(project: Project, user: User):
    is_owner = project.owner_user_id == user.id
    is_admin = (user.role and user.role.name == "admin")
    if not (is_owner or is_admin):
        raise HTTPException(status_code=403, detail="Only owner/admin can manage members")

@router.get("/{project_id}/members", response_model=list[ProjectMemberOut])
async def list_project_members(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = (await db.execute(select(Project).where(Project.id == project_id))).scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # TODO: use ensure_project_access(db, project_id, user.id, allow_view=True)
    # For now keep owner-only:
    if project.owner_user_id != user.id and not (user.role and user.role.name == "admin"):
        raise HTTPException(status_code=403, detail="No access to this project")

    # 1) Load user members
    user_members_stmt = (
        select(ProjectMember)
        .where(ProjectMember.project_id == project_id)
        .options(selectinload(ProjectMember.user).selectinload(User.role))
    )
    user_members = (await db.execute(user_members_stmt)).scalars().all()

    # 2) Load group members
    group_members_stmt = (
        select(ProjectGroupMember)
        .where(ProjectGroupMember.project_id == project_id)
        .options(selectinload(ProjectGroupMember.group))
    )
    group_members = (await db.execute(group_members_stmt)).scalars().all()

    # 3) Build map: user_id -> groups (for showing “user is in which groups”)
    user_ids = [m.user_id for m in user_members if m.user_id]
    user_groups_map: dict[int, list[Group]] = {uid: [] for uid in user_ids}

    if user_ids:
        gm_stmt = (
            select(GroupMember)
            .where(GroupMember.user_id.in_(user_ids))
            .options(selectinload(GroupMember.group))
        )
        gms = (await db.execute(gm_stmt)).scalars().all()
        for gm in gms:
            if gm.group:
                user_groups_map[gm.user_id].append(gm.group)

    out: list[ProjectMemberOut] = []

    # 4) Convert user members
    for m in user_members:
        u = m.user
        role_name = u.role.name if (u and u.role) else None
        is_admin = role_name == "admin"
        is_owner = (u and u.id == project.owner_user_id)

        groups_out = [
            GroupOut(id=g.id, name=g.name) for g in user_groups_map.get(u.id, [])
        ] if u else []

        user_out = None
        if u:
            user_out = MemberUserOut(
                id=u.id,
                email=u.email,
                name=u.name,
                role_name=role_name,
                is_admin=is_admin,
                groups=groups_out,
            )

        out.append(
            ProjectMemberOut(
                id=m.id,
                project_id=m.project_id,
                access_level=m.access_level,
                user_id=m.user_id,
                group_id=None,
                user=user_out,
                group=None,
                is_owner=bool(is_owner),
                is_admin=bool(is_admin),
            )
        )

    # 5) Convert group members
    for gm in group_members:
        g = gm.group
        group_out = GroupOut(id=g.id, name=g.name) if g else None

        out.append(
            ProjectMemberOut(
                id=gm.id,
                project_id=gm.project_id,
                access_level=gm.access_level,
                user_id=None,
                group_id=gm.group_id,
                user=None,
                group=group_out,
                is_owner=False,
                is_admin=False,
            )
        )

    return out
@router.post("/{project_id}/members")
async def add_project_member(
    project_id: int,
    payload: AddProjectMemberIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # only owner/admin can share
    await ensure_project_admin(db, project_id, user)

    # find user by email
    target = (await db.execute(select(User).where(User.email == payload.email))).scalars().first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # don't allow owner to be added as member
    project = await ensure_project_access(db, project_id, user.id, allow_view=True)
    if target.id == project.owner_user_id:
        raise HTTPException(status_code=400, detail="Owner already has access")

    # upsert member row
    existing = (
        await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == target.id,
            )
        )
    ).scalars().first()

    if existing:
        existing.access_level = payload.access_level
        await db.commit()
        await db.refresh(existing)
        return {
            "id": existing.id,
            "project_id": existing.project_id,
            "user_id": existing.user_id,
            "access_level": existing.access_level,
            "user_email": target.email,
            "user_name": target.name,
        }

    m = ProjectMember(
        project_id=project_id,
        user_id=target.id,
        access_level=payload.access_level,
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)

    return {
        "id": m.id,
        "project_id": m.project_id,
        "user_id": m.user_id,
        "access_level": m.access_level,
        "user_email": target.email,
        "user_name": target.name,
    }

@router.delete("/{project_id}/members/{member_id}")
async def remove_project_member(
    project_id: int,
    member_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await ensure_project_admin(db, project_id, user)

    member = (
        await db.execute(
            select(ProjectMember).where(
                ProjectMember.id == member_id,
                ProjectMember.project_id == project_id,
            )
        )
    ).scalars().first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    await db.delete(member)
    await db.commit()
    return {"status": "deleted", "id": member_id}


@router.patch("/{project_id}/members/{member_id}", response_model=ProjectMemberOut)
async def update_member_access(
    project_id: int,
    member_id: int,
    payload: ProjectMemberUpdateIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = await ensure_project_admin(db, project_id, user)

    member = (
        await db.execute(
            select(ProjectMember)
            .where(ProjectMember.id == member_id, ProjectMember.project_id == project_id)
            .options(
                selectinload(ProjectMember.user).selectinload(User.role),
                selectinload(ProjectMember.group),
            )
        )
    ).scalars().first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if payload.access_level not in ("viewer", "editor"):
        raise HTTPException(status_code=422, detail="access_level must be viewer or editor")

    member.access_level = payload.access_level
    await db.commit()
    await db.refresh(member)

    # returnera via samma “enriched” logik:
    # enklast: anropa list_project_members och filtrera, men bättre: bygg out likt ovan.
    # (Jag ger en enkel variant:)
    return await _member_to_out(db, project, member)