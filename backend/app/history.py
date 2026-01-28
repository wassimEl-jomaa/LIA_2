from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from .db import get_db
from .auth import get_current_user
from .permissions import ensure_project_access
from .models import Requirement, TestCase
from pydantic import BaseModel
from typing import Any, Literal, Optional

router = APIRouter(prefix="/api/history", tags=["history"])


class HistoryItemOut(BaseModel):
    type: Literal["requirement", "test_case"]
    id: int
    project_id: int
    created_at: str

    # requirement fields
    requirement_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None

    # test case fields
    expected_result: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None


@router.get("", response_model=list[HistoryItemOut])
async def get_history(
    project_id: int,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    # access check
    await ensure_project_access(db, project_id, user.id, allow_view=True)

    # sanitize limit
    limit = max(1, min(limit, 500))

    # fetch recent requirements
    req_stmt = (
        select(Requirement)
        .where(Requirement.project_id == project_id)
        .order_by(desc(Requirement.created_at))
        .limit(limit)
    )
    reqs = (await db.execute(req_stmt)).scalars().all()

    # fetch recent test cases
    tc_stmt = (
        select(TestCase)
        .where(TestCase.project_id == project_id)
        .order_by(desc(TestCase.created_at))
        .limit(limit)
    )
    tcs = (await db.execute(tc_stmt)).scalars().all()

    items: list[HistoryItemOut] = []

    for r in reqs:
        items.append(
            HistoryItemOut(
                type="requirement",
                id=r.id,
                project_id=r.project_id,
                created_at=str(r.created_at),
                title=r.title,
                description=r.description,
            )
        )

    for t in tcs:
        items.append(
            HistoryItemOut(
                type="test_case",
                id=t.id,
                project_id=t.project_id,
                created_at=str(t.created_at),
                requirement_id=t.requirement_id,
                title=t.title,
                description=t.description,
                expected_result=t.expected_result,
                priority=getattr(t, "priority", None),
                status=getattr(t, "status", None),
            )
        )

    # merge + sort timeline by created_at (string is ISO-like, but safer: sort by actual value if needed)
    items.sort(key=lambda x: x.created_at, reverse=True)

    # apply final limit on merged list
    return items[:limit]