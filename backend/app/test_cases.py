from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from .db import get_db
from .models import TestCase, User
from .schemas import TestCaseCreateIn, TestCaseOut
from .auth import get_current_user
from .permissions import ensure_project_access


router = APIRouter(prefix="/api/test_cases", tags=["test_cases"])


def _tc_to_out(t: TestCase) -> TestCaseOut:
    steps_list = None
    if getattr(t, "steps", None):
        # steps are stored as newline-separated text in the DB
        steps_list = [s for s in t.steps.split("\n") if s != ""]

    return TestCaseOut(
        id=t.id,
        project_id=t.project_id,
        title=t.title,
        description=t.description,
        steps=steps_list,
        expected_result=t.expected_result,
        priority=t.priority,
        status=t.status,
        created_at=str(t.created_at),
    )


@router.post("", response_model=TestCaseOut)
async def create_test_case(
    payload: TestCaseCreateIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Require edit access to project
    await ensure_project_access(db, payload.project_id, user.id, allow_view=False)

    steps_text = None
    if payload.steps:
        if isinstance(payload.steps, list):
            steps_text = "\n".join([str(s) for s in payload.steps if s is not None])
        else:
            steps_text = str(payload.steps)

    tc = TestCase(
        project_id=payload.project_id,
        title=payload.title,
        description=payload.description,
        steps=steps_text,
        expected_result=payload.expected_result,
    )

    db.add(tc)
    await db.commit()
    await db.refresh(tc)

    return _tc_to_out(tc)


@router.get("", response_model=list[TestCaseOut])
async def list_test_cases(
    project_id: int,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await ensure_project_access(db, project_id, user.id, allow_view=True)

    stmt = (
        select(TestCase)
        .where(TestCase.project_id == project_id)
        .order_by(desc(TestCase.id))
        .limit(min(limit, 200))
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [_tc_to_out(r) for r in rows]


@router.get("/{test_case_id}", response_model=TestCaseOut)
async def get_test_case(
    test_case_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
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
    user: User = Depends(get_current_user),
):
    tc = (await db.execute(select(TestCase).where(TestCase.id == test_case_id))).scalars().first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")

    await ensure_project_access(db, tc.project_id, user.id, allow_view=False)

    tc.title = payload.title
    tc.description = payload.description

    if payload.steps:
        if isinstance(payload.steps, list):
            tc.steps = "\n".join([str(s) for s in payload.steps if s is not None])
        else:
            tc.steps = str(payload.steps)

    tc.expected_result = payload.expected_result

    await db.commit()
    await db.refresh(tc)
    return _tc_to_out(tc)


@router.delete("/{test_case_id}")
async def delete_test_case(
    test_case_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tc = (await db.execute(select(TestCase).where(TestCase.id == test_case_id))).scalars().first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")

    await ensure_project_access(db, tc.project_id, user.id, allow_view=False)

    await db.delete(tc)
    await db.commit()
    return {"status": "deleted", "id": test_case_id}
