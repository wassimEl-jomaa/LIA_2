from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload
from typing import Any, Optional

from .db import get_db
from .models import TestExecution, TestCase
from .schemas import TestExecutionCreateIn, TestExecutionUpdateIn, TestExecutionOut
from .auth import get_current_user
from .permissions import ensure_project_access

router = APIRouter(prefix="/api/test_executions", tags=["test_executions"])


def _exec_to_out(e: TestExecution) -> TestExecutionOut:
    return TestExecutionOut(
        id=e.id,
        project_id=e.project_id,
        test_case_id=e.test_case_id,
        test_run_id=e.test_run_id,

        executed_by_user_id=e.executed_by_user_id,
        executed_by_user_name=(e.executed_by_user.name if e.executed_by_user else None),

        status=e.status,
        result=e.result,

        started_at=e.started_at,
        finished_at=e.finished_at,

        environment_json=e.environment_json,

        build_number=e.build_number,
        git_sha=e.git_sha,
        branch=e.branch,

        ci_run_id=e.ci_run_id,
        job_url=e.job_url,

        notes=e.notes,
        artifacts=e.artifacts,

        attempt=e.attempt,

        created_at=e.created_at,
        updated_at=e.updated_at,
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

    # started_at: if not provided, DB default will set it (server_default=now()).
    # finished_at: set if result is not pending OR status completed.
    finished_at = None
    if payload.result != "pending":
        finished_at = payload.finished_at or func.now()

    exec_row = TestExecution(
        project_id=payload.project_id,
        test_case_id=payload.test_case_id,
        test_run_id=payload.test_run_id,

        executed_by_user_id=user.id,  # set from logged-in user

        status=payload.status,
        result=payload.result,

        started_at=payload.started_at,   # optional; DB default if None
        finished_at=finished_at,

        environment_json=payload.environment_json,

        build_number=payload.build_number,
        git_sha=payload.git_sha,
        branch=payload.branch,

        ci_run_id=payload.ci_run_id,
        job_url=payload.job_url,

        notes=payload.notes,
        artifacts=payload.artifacts,

        attempt=payload.attempt,
    )

    db.add(exec_row)
    await db.commit()
    await db.refresh(exec_row)

    # load executed_by_user for output name (optional)
    exec_row = (
        await db.execute(
            select(TestExecution)
            .options(selectinload(TestExecution.executed_by_user))
            .where(TestExecution.id == exec_row.id)
        )
    ).scalars().first()

    return _exec_to_out(exec_row)


@router.get("", response_model=list[TestExecutionOut])
async def list_test_executions(
    project_id: int,
    test_run_id: Optional[int] = None,
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

    if test_run_id is not None:
        stmt = stmt.where(TestExecution.test_run_id == test_run_id)

    if test_case_id is not None:
        stmt = stmt.where(TestExecution.test_case_id == test_case_id)

    rows = (await db.execute(stmt.order_by(desc(TestExecution.id)).limit(limit))).scalars().all()
    return [_exec_to_out(r) for r in rows]


@router.put("/{execution_id}", response_model=TestExecutionOut)
async def update_test_execution(
    execution_id: int,
    payload: TestExecutionUpdateIn,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    exec_row = (
        await db.execute(
            select(TestExecution)
            .options(selectinload(TestExecution.executed_by_user))
            .where(TestExecution.id == execution_id)
        )
    ).scalars().first()

    if not exec_row:
        raise HTTPException(status_code=404, detail="Execution not found")

    await ensure_project_access(db, exec_row.project_id, user.id, allow_view=False)

    # Update only provided fields
    if payload.status is not None:
        exec_row.status = payload.status

    if payload.result is not None:
        exec_row.result = payload.result

        # If result becomes non-pending and finished_at not set, set it
        if payload.result != "pending" and exec_row.finished_at is None:
            exec_row.finished_at = payload.finished_at or func.now()

        # If result returns to pending, optionally clear finished_at
        if payload.result == "pending":
            exec_row.finished_at = None

    if payload.started_at is not None:
        exec_row.started_at = payload.started_at

    if payload.finished_at is not None:
        exec_row.finished_at = payload.finished_at

    if payload.environment_json is not None:
        exec_row.environment_json = payload.environment_json

    if payload.build_number is not None:
        exec_row.build_number = payload.build_number

    if payload.git_sha is not None:
        exec_row.git_sha = payload.git_sha

    if payload.branch is not None:
        exec_row.branch = payload.branch

    if payload.ci_run_id is not None:
        exec_row.ci_run_id = payload.ci_run_id

    if payload.job_url is not None:
        exec_row.job_url = payload.job_url

    if payload.notes is not None:
        exec_row.notes = payload.notes

    if payload.artifacts is not None:
        exec_row.artifacts = payload.artifacts

    if payload.attempt is not None:
        exec_row.attempt = payload.attempt

    await db.commit()
    await db.refresh(exec_row)
    return _exec_to_out(exec_row)

@router.delete("/{execution_id}", status_code=204)
async def delete_test_execution(
    execution_id: int,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    # Find execution
    exec_row = (
        await db.execute(select(TestExecution).where(TestExecution.id == execution_id))
    ).scalars().first()

    if not exec_row:
        raise HTTPException(status_code=404, detail="Execution not found")

    # Permission check (must have edit access)
    await ensure_project_access(db, exec_row.project_id, user.id, allow_view=False)

    # Delete
    await db.delete(exec_row)
    await db.commit()

    return Response(status_code=204)