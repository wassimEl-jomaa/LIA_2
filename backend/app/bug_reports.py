from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Any, Optional

from .db import get_db
from .models import BugReport
from .schemas import BugReportCreateIn, BugReportUpdateIn, BugReportOut, AIOut, BugReportAIReportIn
from .auth import get_current_user
from .permissions import ensure_project_access
from .ai import call_ai_json, prompt_bug_triage

router = APIRouter(prefix="/api/bug_reports", tags=["bug_reports"])

@router.post("", response_model=BugReportOut)
async def create_bug(
    payload: BugReportCreateIn,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    await ensure_project_access(db, payload.project_id, user.id, allow_view=False)

    bug = BugReport(
        project_id=payload.project_id,
        requirement_id=payload.requirement_id,
        test_case_id=payload.test_case_id,
        test_execution_id=payload.test_execution_id,
        reported_by_user_id=user.id,

        title=payload.title,
        description=payload.description,
        steps_to_reproduce=payload.steps_to_reproduce,
        expected_result=payload.expected_result,
        actual_result=payload.actual_result,

        severity=payload.severity,
        priority=payload.priority,
        status=payload.status,
        environment=payload.environment,
    )
    db.add(bug)
    await db.commit()
    await db.refresh(bug)
    return bug


@router.get("", response_model=list[BugReportOut])
async def list_bugs(
    project_id: int,
    requirement_id: Optional[int] = None,
    test_case_id: Optional[int] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    await ensure_project_access(db, project_id, user.id, allow_view=True)

    limit = max(1, min(limit, 500))

    stmt = select(BugReport).where(BugReport.project_id == project_id)

    if requirement_id is not None:
        stmt = stmt.where(BugReport.requirement_id == requirement_id)
    if test_case_id is not None:
        stmt = stmt.where(BugReport.test_case_id == test_case_id)
    if status:
        stmt = stmt.where(BugReport.status == status)
    if severity:
        stmt = stmt.where(BugReport.severity == severity)

    stmt = stmt.order_by(desc(BugReport.id)).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()
    return rows


@router.post("/ai_report", response_model=AIOut)
async def bug_ai_report_from_payload(
    payload: BugReportAIReportIn,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    await ensure_project_access(db, payload.project_id, user.id, allow_view=True)

    prompt = prompt_bug_triage(
        payload.title,
        payload.description,
        payload.steps_to_reproduce,
        payload.expected_result,
        payload.actual_result,
    )
    raw, parsed = call_ai_json(prompt)

    bug = BugReport(
        project_id=payload.project_id,
        reported_by_user_id=user.id,

        title=payload.title,
        description=payload.description,
        steps_to_reproduce=payload.steps_to_reproduce,
        expected_result=payload.expected_result,
        actual_result=payload.actual_result,

        ai_report_json=parsed,
        ai_report_raw=raw,
        ai_reported_at=datetime.utcnow(),
    )
    db.add(bug)
    await db.commit()
    await db.refresh(bug)

    return AIOut(parsed_json=parsed, raw_text=raw)


@router.get("/{bug_id}", response_model=BugReportOut)
async def get_bug(
    bug_id: int,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    bug = (await db.execute(select(BugReport).where(BugReport.id == bug_id))).scalars().first()
    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")

    await ensure_project_access(db, bug.project_id, user.id, allow_view=True)
    return bug


@router.put("/{bug_id}", response_model=BugReportOut)
async def update_bug(
    bug_id: int,
    payload: BugReportUpdateIn,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    bug = (await db.execute(select(BugReport).where(BugReport.id == bug_id))).scalars().first()
    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")

    await ensure_project_access(db, bug.project_id, user.id, allow_view=False)

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(bug, k, v)

    await db.commit()
    await db.refresh(bug)
    return bug


@router.delete("/{bug_id}")
async def delete_bug(
    bug_id: int,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    bug = (await db.execute(select(BugReport).where(BugReport.id == bug_id))).scalars().first()
    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")

    await ensure_project_access(db, bug.project_id, user.id, allow_view=False)

    await db.delete(bug)
    await db.commit()
    return {"status": "deleted", "id": bug_id}


@router.post("/{bug_id}/ai_report", response_model=AIOut)
async def bug_ai_report(
    bug_id: int,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    bug = (await db.execute(select(BugReport).where(BugReport.id == bug_id))).scalars().first()
    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")

    await ensure_project_access(db, bug.project_id, user.id, allow_view=True)

    prompt = prompt_bug_triage(
        bug.title,
        bug.description,
        bug.steps_to_reproduce,
        bug.expected_result,
        bug.actual_result,
    )
    raw, parsed = call_ai_json(prompt)

    bug.ai_report_json = parsed
    bug.ai_report_raw = raw
    bug.ai_reported_at = datetime.utcnow()
    await db.commit()
    await db.refresh(bug)

    return AIOut(parsed_json=parsed, raw_text=raw)
