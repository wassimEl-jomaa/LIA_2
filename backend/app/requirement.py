import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from .permissions import ensure_project_access  # ✅ access for owner + members
from .db import get_db
from .models import Requirement, User, TestCase
from .schemas import RequirementCreateIn, RequirementUpdateIn, RequirementOut, TestCaseOut
from .auth import get_current_user



router = APIRouter(prefix="/api/requirements", tags=["requirements"])


def _req_to_out(r: Requirement, test_cases: list[TestCase] | None = None) -> RequirementOut:
    probs = None
    if getattr(r, "probabilities_json", None):
        try:
            probs = json.loads(r.probabilities_json)
        except Exception:
            probs = None

    tc_out = None
    if test_cases:
        tc_out = []
        for t in test_cases:
            steps_list = None
            if getattr(t, "steps", None):
                steps_list = [s for s in t.steps.split("\n") if s != ""]

            tc_out.append(
                TestCaseOut(
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
            )

    return RequirementOut(
        id=r.id,
        project_id=r.project_id,
        requirement_text=r.requirement_text,
        predicted_category=r.predicted_category,
        confidence=float(r.confidence or 0.0),
        probabilities=probs,
        test_cases=tc_out,
        created_at=str(r.created_at),
    )


@router.post("", response_model=RequirementOut)
async def create_requirement(
    payload: RequirementCreateIn,
    predict: bool = Query(True, description="If true, run ML prediction and store result"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # ✅ Allow owner + project members to create (editor check)
    await ensure_project_access(db, payload.project_id, user.id, allow_view=False)

    predicted_category = "Unknown"
    confidence = 0.0
    probs = None

    if predict:
        predicted_category, confidence, probs = predict_category(payload.text)

    req = Requirement(
        project_id=payload.project_id,
        requirement_text=payload.text,
        predicted_category=predicted_category,
        confidence=float(confidence or 0.0),
        probabilities_json=json.dumps(probs, ensure_ascii=False) if probs else None,
    )

    db.add(req)
    await db.commit()
    await db.refresh(req)

    # If the client provided test cases together with the requirement,
    # create corresponding TestCase rows linked to this requirement.
    tcs_payload = getattr(payload, "test_cases", None)
    if tcs_payload:
        for tc in tcs_payload:
            title = tc.get("title") if isinstance(tc, dict) else getattr(tc, "title", None)
            if not title:
                continue
            description = tc.get("description") if isinstance(tc, dict) else getattr(tc, "description", None)
            steps_in = tc.get("steps") if isinstance(tc, dict) else getattr(tc, "steps", None)
            steps_text = None
            if isinstance(steps_in, list):
                steps_text = "\n".join([str(s) for s in steps_in if s is not None])
            elif isinstance(steps_in, str):
                steps_text = steps_in

            expected = tc.get("expected_result") if isinstance(tc, dict) else getattr(tc, "expected_result", None)

            tc_obj = TestCase(
                project_id=payload.project_id,
                requirement_id=req.id,
                title=title,
                description=description,
                steps=steps_text,
                expected_result=expected,
            )
            db.add(tc_obj)

        await db.commit()

    # Load test cases for the requirement (if any) and include in response
    stmt = select(TestCase).where(TestCase.requirement_id == req.id)
    created_rows = (await db.execute(stmt)).scalars().all()
    return _req_to_out(req, test_cases=created_rows)


@router.get("/{requirement_id}", response_model=RequirementOut)
async def get_requirement(
    requirement_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    req = (await db.execute(select(Requirement).where(Requirement.id == requirement_id))).scalars().first()
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")

    # ✅ Allow owner + members to view
    await ensure_project_access(db, req.project_id, user.id, allow_view=True)
    return _req_to_out(req)


@router.get("", response_model=list[RequirementOut])
async def list_requirements(
    project_id: int,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # ✅ Allow owner + members to view
    await ensure_project_access(db, project_id, user.id, allow_view=True)

    stmt = (
        select(Requirement)
        .where(Requirement.project_id == project_id)
        .order_by(desc(Requirement.id))
        .limit(min(limit, 200))
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [_req_to_out(r) for r in rows]

    # If the client provided test cases together with the requirement,
    # create corresponding TestCase rows linked to this requirement.
    tcs = getattr(payload, "test_cases", None)
    if tcs:
        for tc in tcs:
            # Accept either a dict or a pydantic object; be defensive about fields
            title = tc.get("title") if isinstance(tc, dict) else getattr(tc, "title", None)
            if not title:
                continue
            description = tc.get("description") if isinstance(tc, dict) else getattr(tc, "description", None)
            steps_in = tc.get("steps") if isinstance(tc, dict) else getattr(tc, "steps", None)
            # Store steps as newline-separated text
            steps_text = None
            if isinstance(steps_in, list):
                steps_text = "\n".join([str(s) for s in steps_in if s is not None])
            elif isinstance(steps_in, str):
                steps_text = steps_in

            expected = tc.get("expected_result") if isinstance(tc, dict) else getattr(tc, "expected_result", None)

            tc_obj = TestCase(
                project_id=payload.project_id,
                requirement_id=req.id,
                title=title,
                description=description,
                steps=steps_text,
                expected_result=expected,
            )
            db.add(tc_obj)

        await db.commit()

@router.put("/{requirement_id}", response_model=RequirementOut)
async def update_requirement(
    requirement_id: int,
    payload: RequirementUpdateIn,
    predict: bool = Query(True, description="If true, re-run ML prediction after update"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    req = (await db.execute(select(Requirement).where(Requirement.id == requirement_id))).scalars().first()
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")

    # ✅ Allow owner + members to edit (editor check)
    await ensure_project_access(db, req.project_id, user.id, allow_view=False)

    req.requirement_text = payload.text

    if predict:
        pred, conf, probs = predict_category(payload.text)
        req.predicted_category = pred
        req.confidence = float(conf or 0.0)
        req.probabilities_json = json.dumps(probs, ensure_ascii=False) if probs else None

    await db.commit()
    await db.refresh(req)
    return _req_to_out(req)


@router.delete("/{requirement_id}")
async def delete_requirement(
    requirement_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    req = (await db.execute(select(Requirement).where(Requirement.id == requirement_id))).scalars().first()
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")

    # ✅ Allow owner + members to delete (editor check)
    await ensure_project_access(db, req.project_id, user.id, allow_view=False)

    await db.delete(req)
    await db.commit()
    return {"status": "deleted", "id": requirement_id}
