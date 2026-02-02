from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_, func
from sqlalchemy.orm import selectinload
from typing import Any, Optional

from .db import get_db
from .models import TestExecution, TestCase
from .schemas import TestExecutionCreateIn, TestExecutionOut
from .auth import get_current_user
from .permissions import ensure_project_access

router = APIRouter(prefix="/api/test_executions", tags=["test_executions"])


def _exec_to_out(e: TestExecution) -> TestExecutionOut:
    return TestExecutionOut(
        id=e.id,
        project_id=e.project_id,
        test_case_id=e.test_case_id,
        executed_by_user_id=e.executed_by_user_id,
        executed_by_user_name=(e.executed_by_user.name if e.executed_by_user else None),
        result=e.result,
        notes=e.notes,
        started_at=str(e.started_at) if e.started_at else None,
        finished_at=str(e.finished_at) if e.finished_at else None,
        created_at=str(e.created_at),
    )


@router.post("", response_model=TestExecutionOut)
async def create_test_execution(
    payload: TestExecutionCreateIn,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    await ensure_project_access(db, payload.project_id, user.id, allow_view=False)

    tc = (
        await db.execute(select(TestCase).where(TestCase.id == payload.test_case_id))
    ).scalars().first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")

    if tc.project_id != payload.project_id:
        raise HTTPException(status_code=400, detail="Test case does not belong to project")

    finished_at = func.now() if payload.result and payload.result != "Pending" else None

    exec_row = TestExecution(
        project_id=payload.project_id,
        test_case_id=payload.test_case_id,
        executed_by_user_id=user.id,
        result=payload.result,
        notes=payload.notes,
        finished_at=finished_at,
    )

    db.add(exec_row)
    await db.commit()
    await db.refresh(exec_row)
    return _exec_to_out(exec_row)


@router.get("", response_model=list[TestExecutionOut])
async def list_test_executions(
    project_id: int,
    test_case_id: Optional[int] = None,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    await ensure_project_access(db, project_id, user.id, allow_view=True)

    limit = max(1, min(limit, 500))

    stmt = (
        select(TestExecution)
        .options(selectinload(TestExecution.executed_by_user))
        .where(TestExecution.project_id == project_id)
    )
    if test_case_id is not None:
        stmt = stmt.where(TestExecution.test_case_id == test_case_id)

    rows = (await db.execute(stmt.order_by(desc(TestExecution.id)).limit(limit))).scalars().all()
    return [_exec_to_out(r) for r in rows]


@router.put("/{execution_id}", response_model=TestExecutionOut)
async def update_test_execution(
    execution_id: int,
    payload: TestExecutionCreateIn,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    exec_row = (
        await db.execute(select(TestExecution).where(TestExecution.id == execution_id))
    ).scalars().first()
    if not exec_row:
        raise HTTPException(status_code=404, detail="Execution not found")

    await ensure_project_access(db, exec_row.project_id, user.id, allow_view=False)

    exec_row.result = payload.result
    exec_row.notes = payload.notes
    if payload.result and payload.result != "Pending":
        exec_row.finished_at = func.now()

    await db.commit()
    await db.refresh(exec_row)
    return _exec_to_out(exec_row)
