import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from .permissions import ensure_project_access  # ✅ access for owner + members
from .db import get_db
from .models import Requirement, User
from .schemas import RequirementCreateIn, RequirementUpdateIn, RequirementOut
from .auth import get_current_user



router = APIRouter(prefix="/api/requirements", tags=["requirements"])


def _req_to_out(r: Requirement) -> RequirementOut:
    probs = None
    if getattr(r, "probabilities_json", None):
        try:
            probs = json.loads(r.probabilities_json)
        except Exception:
            probs = None

    return RequirementOut(
        id=r.id,
        project_id=r.project_id,
        requirement_text=r.requirement_text,
        predicted_category=r.predicted_category,
        confidence=float(r.confidence or 0.0),
        probabilities=probs,
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
    return _req_to_out(req)


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
