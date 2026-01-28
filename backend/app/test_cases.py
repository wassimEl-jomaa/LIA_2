from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_
from sqlalchemy.exc import IntegrityError
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from .db import get_db
from .models import TestCase, User
from .schemas import TestCaseCreateIn, TestCaseOut
from .auth import get_current_user
from .permissions import ensure_project_access
from typing import Any

router = APIRouter(prefix="/api/test_cases", tags=["test_cases"])


def _tc_to_out(t: TestCase) -> TestCaseOut:
    steps_list = None
    if getattr(t, "steps", None):
        # prefer JSON-encoded arrays, fall back to newline-separated text
        try:
            parsed = json.loads(t.steps)
            if isinstance(parsed, list):
                steps_list = [str(s) for s in parsed if s is not None]
            else:
                raise ValueError()
        except Exception:
            steps_list = [s for s in t.steps.split("\n") if s != ""]

    preconds_list = None
    if getattr(t, "preconditions", None):
        try:
            parsed = json.loads(t.preconditions)
            if isinstance(parsed, list):
                preconds_list = [str(s) for s in parsed if s is not None]
            else:
                raise ValueError()
        except Exception:
            preconds_list = [s for s in t.preconditions.split("\n") if s != ""]

    return TestCaseOut(
        id=t.id,
        project_id=t.project_id,
        title=t.title,
        description=t.description,
        steps=steps_list,
        preconditions=preconds_list,
        expected_result=t.expected_result,
        priority=t.priority,
        status=t.status,
        created_at=str(t.created_at),
    )


@router.post("", response_model=TestCaseOut)
async def create_test_case(
    payload: TestCaseCreateIn,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    # Require edit access to project
    await ensure_project_access(db, payload.project_id, user.id, allow_view=False)

    steps_text = None
    if payload.steps:
        if isinstance(payload.steps, list):
            steps_text = json.dumps([str(s) for s in payload.steps if s is not None])
        else:
            steps_text = str(payload.steps)

    preconds_text = None
    if getattr(payload, "preconditions", None):
        if isinstance(payload.preconditions, list):
            preconds_text = json.dumps([str(s) for s in payload.preconditions if s is not None])
        else:
            preconds_text = str(payload.preconditions)

    tc = TestCase(
    project_id=payload.project_id,
    requirement_id=payload.requirement_id,  # ✅ add this
    title=payload.title,
    description=payload.description,
    steps=steps_text,
    preconditions=preconds_text,
    expected_result=payload.expected_result,
)

    db.add(tc)
    try:
        await db.commit()
        await db.refresh(tc)
        return _tc_to_out(tc)
    except IntegrityError:
        # Possible unique constraint violation on (project_id, title).
        # Roll back and attempt to return the existing record instead of 500.
        await db.rollback()
        existing = (
            await db.execute(
                select(TestCase).where(and_(TestCase.project_id == payload.project_id, TestCase.title == payload.title))
            )
        ).scalars().first()
        if existing:
            return _tc_to_out(existing)
        # If we couldn't find it, re-raise as 500
        raise HTTPException(status_code=500, detail="Failed to create test case due to database error")


@router.get("", response_model=list[TestCaseOut])
async def list_test_cases(
    project_id: int,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    await ensure_project_access(db, project_id, user.id, allow_view=True)

    # sanitize limit to a sensible range
    limit = max(1, min(limit, 200))

    stmt = (
        select(TestCase)
        .where(TestCase.project_id == project_id)
        .order_by(desc(TestCase.id))
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [_tc_to_out(r) for r in rows]


@router.get("/{test_case_id}", response_model=TestCaseOut)
async def get_test_case(
    test_case_id: int,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    tc = (await db.execute(select(TestCase).where(TestCase.id == test_case_id))).scalars().first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")

    await ensure_project_access(db, tc.project_id, user.id, allow_view=True)
    return _tc_to_out(tc)


@router.put("/{test_case_id}", response_model=TestCaseOut)
async def update_test_case(
    test_case_id: int,
    payload: TestCaseCreateIn,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    tc = (await db.execute(select(TestCase).where(TestCase.id == test_case_id))).scalars().first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")

    await ensure_project_access(db, tc.project_id, user.id, allow_view=False)

    tc.title = payload.title
    tc.description = payload.description

    if payload.steps:
        if isinstance(payload.steps, list):
            tc.steps = json.dumps([str(s) for s in payload.steps if s is not None])
        else:
            tc.steps = str(payload.steps)

    if getattr(payload, "preconditions", None):
        if isinstance(payload.preconditions, list):
            tc.preconditions = json.dumps([str(s) for s in payload.preconditions if s is not None])
        else:
            tc.preconditions = str(payload.preconditions)

    tc.expected_result = payload.expected_result

    await db.commit()
    await db.refresh(tc)
    return _tc_to_out(tc)


@router.delete("/{test_case_id}")
async def delete_test_case(
    test_case_id: int,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    tc = (await db.execute(select(TestCase).where(TestCase.id == test_case_id))).scalars().first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")

    await ensure_project_access(db, tc.project_id, user.id, allow_view=False)

    await db.delete(tc)
    await db.commit()
    return {"status": "deleted", "id": test_case_id}
