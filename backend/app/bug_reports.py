from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Any, Optional

from .db import get_db
from .models import BugReport
from .schemas import BugReportCreateIn, BugReportUpdateIn, BugReportOut, AIOut, BugReportAIReportIn, BugStatusChangeIn
from .auth import get_current_user
from .permissions import ensure_project_access
from .ai import call_ai_json, prompt_bug_triage
from .bug_status_history_utils import record_status_change

router = APIRouter(prefix="/api/bug_reports", tags=["bug_reports"])

@router.post("")
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
    return {
        "id": bug.id,
        "project_id": bug.project_id,
        "requirement_id": bug.requirement_id,
        "test_case_id": bug.test_case_id,
        "test_execution_id": bug.test_execution_id,
        "reported_by_user_id": bug.reported_by_user_id,
        "title": bug.title,
        "description": bug.description,
        "steps_to_reproduce": bug.steps_to_reproduce,
        "expected_result": bug.expected_result,
        "actual_result": bug.actual_result,
        "severity": bug.severity,
        "priority": bug.priority,
        "status": bug.status,
        "environment": bug.environment,
        "ai_report_json": bug.ai_report_json,
        "ai_report_raw": bug.ai_report_raw,
        "ai_reported_at": bug.ai_reported_at.isoformat() if bug.ai_reported_at else None,
        "created_at": bug.created_at.isoformat() if bug.created_at else None,
        "updated_at": bug.updated_at.isoformat() if bug.updated_at else None,
    }


@router.get("")
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
    """List bug reports for a project."""
    try:
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
        
        # Convert to dicts for JSON serialization
        result = []
        for row in rows:
            result.append({
                "id": row.id,
                "project_id": row.project_id,
                "requirement_id": row.requirement_id,
                "test_case_id": row.test_case_id,
                "test_execution_id": row.test_execution_id,
                "reported_by_user_id": row.reported_by_user_id,
                "title": row.title,
                "description": row.description,
                "steps_to_reproduce": row.steps_to_reproduce,
                "expected_result": row.expected_result,
                "actual_result": row.actual_result,
                "severity": row.severity,
                "priority": row.priority,
                "status": row.status,
                "environment": row.environment,
                "ai_report_json": row.ai_report_json,
                "ai_report_raw": row.ai_report_raw,
                "ai_reported_at": row.ai_reported_at.isoformat() if row.ai_reported_at else None,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            })
        return result
    except Exception as e:
        print(f"ERROR in list_bugs: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


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


@router.get("/{bug_id}")
async def get_bug(
    bug_id: int,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    bug = (await db.execute(select(BugReport).where(BugReport.id == bug_id))).scalars().first()
    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")

    await ensure_project_access(db, bug.project_id, user.id, allow_view=True)
    return {
        "id": bug.id,
        "project_id": bug.project_id,
        "requirement_id": bug.requirement_id,
        "test_case_id": bug.test_case_id,
        "test_execution_id": bug.test_execution_id,
        "reported_by_user_id": bug.reported_by_user_id,
        "title": bug.title,
        "description": bug.description,
        "steps_to_reproduce": bug.steps_to_reproduce,
        "expected_result": bug.expected_result,
        "actual_result": bug.actual_result,
        "severity": bug.severity,
        "priority": bug.priority,
        "status": bug.status,
        "environment": bug.environment,
        "ai_report_json": bug.ai_report_json,
        "ai_report_raw": bug.ai_report_raw,
        "ai_reported_at": bug.ai_reported_at.isoformat() if bug.ai_reported_at else None,
        "created_at": bug.created_at.isoformat() if bug.created_at else None,
        "updated_at": bug.updated_at.isoformat() if bug.updated_at else None,
    }


@router.put("/{bug_id}")
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
    return {
        "id": bug.id,
        "project_id": bug.project_id,
        "requirement_id": bug.requirement_id,
        "test_case_id": bug.test_case_id,
        "test_execution_id": bug.test_execution_id,
        "reported_by_user_id": bug.reported_by_user_id,
        "title": bug.title,
        "description": bug.description,
        "steps_to_reproduce": bug.steps_to_reproduce,
        "expected_result": bug.expected_result,
        "actual_result": bug.actual_result,
        "severity": bug.severity,
        "priority": bug.priority,
        "status": bug.status,
        "environment": bug.environment,
        "ai_report_json": bug.ai_report_json,
        "ai_report_raw": bug.ai_report_raw,
        "ai_reported_at": bug.ai_reported_at.isoformat() if bug.ai_reported_at else None,
        "created_at": bug.created_at.isoformat() if bug.created_at else None,
        "updated_at": bug.updated_at.isoformat() if bug.updated_at else None,
    }


@router.post("/{bug_id}/status")
async def change_bug_status(
    bug_id: int,
    payload: BugStatusChangeIn,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    """Dedicated endpoint for changing bug status with comment and history tracking."""
    bug = (await db.execute(select(BugReport).where(BugReport.id == bug_id))).scalars().first()
    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")
    
    await ensure_project_access(db, bug.project_id, user.id, allow_view=False)
    
    # Validate status
    valid_statuses = ["new", "triaged", "in_progress", "fixed", "retest_pending", "verified", "reopened"]
    if payload.status not in valid_statuses:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )
    
    old_status = bug.status
    
    if old_status == payload.status:
        raise HTTPException(status_code=400, detail="Status is already set to this value")
    
    # Update status
    bug.status = payload.status
    
    # Record the change in history
    record_status_change(
        db=db,
        bug_id=bug.id,
        from_status=old_status,
        to_status=payload.status,
        changed_by_user_id=user.id,
        comment=payload.comment
    )
    
    await db.commit()
    await db.refresh(bug)
    
    return {
        "bug_id": bug.id,
        "old_status": old_status,
        "new_status": payload.status,
        "changed_by": user.id,
        "comment": payload.comment
    }


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
