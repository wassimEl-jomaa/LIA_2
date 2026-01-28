import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.exc import SQLAlchemyError

from .permissions import ensure_project_access
from .db import get_db
from .models import Requirement, TestCase, User
from .schemas import RequirementCreateIn, RequirementUpdateIn, RequirementOut, TestCaseOut
from .auth import get_current_user

router = APIRouter(prefix="/api/requirements", tags=["requirements"])


def _tc_to_out(t: TestCase) -> TestCaseOut:
    steps_list = None
    if getattr(t, "steps", None):
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


def _req_to_out(r: Requirement, test_cases: list[TestCase] | None = None) -> RequirementOut:
    tc_out: list[TestCaseOut] = []
    if test_cases:
        tc_out = [_tc_to_out(t) for t in test_cases]

    return RequirementOut(
        id=r.id,
        project_id=r.project_id,
        title=r.title,
        description=r.description,
        acceptance_criteria=r.acceptance_criteria,
        source=r.source,
        external_id=r.external_id,
        test_cases=tc_out,
        created_at=str(r.created_at),
    )


@router.post("", response_model=RequirementOut)
async def create_requirement(
    payload: RequirementCreateIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await ensure_project_access(db, payload.project_id, user.id, allow_view=False)

    req = Requirement(
        project_id=payload.project_id,
        title=payload.title,
        description=payload.description,
        acceptance_criteria=payload.acceptance_criteria,
        source=payload.source or "manual",
        external_id=payload.external_id,
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)

    # optional: create test cases provided in payload.test_cases
    tcs_payload = payload.test_cases
    if isinstance(tcs_payload, str):
        try:
            tcs_payload = json.loads(tcs_payload)
        except Exception:
            tcs_payload = None

    created_tc_rows: list[TestCase] = []
    if tcs_payload:
        try:
            for tc in tcs_payload:
                if isinstance(tc, str):
                    try:
                        tc = json.loads(tc)
                    except Exception:
                        tc = {"title": tc}

                if not isinstance(tc, dict):
                    continue

                title = (tc.get("title") or tc.get("name") or "Auto-generated test case").strip()[:255]
                description = tc.get("description") or tc.get("desc")

                steps_in = tc.get("steps") or tc.get("step")
                expected = tc.get("expected_result") or tc.get("expected")

                # normalize steps to newline TEXT (same as /api/test_cases)
                steps_text = None
                if isinstance(steps_in, list):
                    steps_text = "\n".join([str(s) for s in steps_in if s is not None])
                elif isinstance(steps_in, str):
                    steps_text = steps_in

                tc_obj = TestCase(
                    project_id=payload.project_id,
                    requirement_id=req.id,
                    title=title,
                    description=description,
                    steps=steps_text,
                    expected_result=expected,
                )
                db.add(tc_obj)
                created_tc_rows.append(tc_obj)

            await db.commit()
            # refresh created rows (optional)
            for t in created_tc_rows:
                await db.refresh(t)

        except SQLAlchemyError as e:
            print(f"[REQUIREMENT] Failed to create test cases: {e}")
            try:
                await db.rollback()
            except Exception:
                pass

    # load test cases for response
    stmt = select(TestCase).where(TestCase.requirement_id == req.id).order_by(desc(TestCase.id))
    rows = (await db.execute(stmt)).scalars().all()
    return _req_to_out(req, test_cases=rows)


@router.get("/{requirement_id}", response_model=RequirementOut)
async def get_requirement(
    requirement_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    req = (await db.execute(select(Requirement).where(Requirement.id == requirement_id))).scalars().first()
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")

    await ensure_project_access(db, req.project_id, user.id, allow_view=True)

    stmt = select(TestCase).where(TestCase.requirement_id == req.id).order_by(desc(TestCase.id))
    rows = (await db.execute(stmt)).scalars().all()
    return _req_to_out(req, test_cases=rows)


@router.get("", response_model=list[RequirementOut])
async def list_requirements(
    project_id: int,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await ensure_project_access(db, project_id, user.id, allow_view=True)
    limit = max(1, min(limit, 200))

    stmt = (
        select(Requirement)
        .where(Requirement.project_id == project_id)
        .order_by(desc(Requirement.id))
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()

    # If you want test_cases in list view, you'd need extra queries.
    # For now, return requirements with empty test_cases to keep list fast.
    return [_req_to_out(r, test_cases=[]) for r in rows]


@router.put("/{requirement_id}", response_model=RequirementOut)
async def update_requirement(
    requirement_id: int,
    payload: RequirementUpdateIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    req = (await db.execute(select(Requirement).where(Requirement.id == requirement_id))).scalars().first()
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")

    await ensure_project_access(db, req.project_id, user.id, allow_view=False)

    req.title = payload.title
    req.description = payload.description
    req.acceptance_criteria = payload.acceptance_criteria

    if payload.source is not None:
        req.source = payload.source
    if payload.external_id is not None:
        req.external_id = payload.external_id

    await db.commit()
    await db.refresh(req)

    stmt = select(TestCase).where(TestCase.requirement_id == req.id).order_by(desc(TestCase.id))
    rows = (await db.execute(stmt)).scalars().all()
    return _req_to_out(req, test_cases=rows)


@router.delete("/{requirement_id}")
async def delete_requirement(
    requirement_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    req = (await db.execute(select(Requirement).where(Requirement.id == requirement_id))).scalars().first()
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")

    await ensure_project_access(db, req.project_id, user.id, allow_view=False)

    await db.delete(req)
    await db.commit()
    return {"status": "deleted", "id": requirement_id}
