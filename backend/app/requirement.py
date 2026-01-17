import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from .db import get_db
from .models import Requirement, User, Project
from .schemas import RequirementCreateIn, RequirementUpdateIn, RequirementOut
from .auth import get_current_user

# Optional ML prediction (if you have it)
# from .ml import predict_category

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


async def ensure_project_owner(db: AsyncSession, project_id: int, user_id: int) -> Project:
    stmt = select(Project).where(Project.id == project_id, Project.owner_user_id == user_id)
    project = (await db.execute(stmt)).scalars().first()
    if not project:
        raise HTTPException(status_code=403, detail="Project not found or not owned by user")
    return project


@router.post("", response_model=RequirementOut)
async def create_requirement(
    payload: RequirementCreateIn,
    predict: bool = Query(True, description="If true, run ML prediction and store result"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await ensure_project_owner(db, payload.project_id, user.id)

    predicted_category = "Unknown"
    confidence = 0.0
    probs = None

    # If you have ML prediction, uncomment these lines:
    # if predict:
    #     predicted_category, confidence, probs = predict_category(payload.text)

    req = Requirement(
        project_id=payload.project_id,
        requirement_text=payload.text,
        predicted_category=predicted_category,
        confidence=float(confidence),
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

    await ensure_project_owner(db, req.project_id, user.id)
    return _req_to_out(req)


@router.get("", response_model=list[RequirementOut])
async def list_requirements(
    project_id: int,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await ensure_project_owner(db, project_id, user.id)

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

    await ensure_project_owner(db, req.project_id, user.id)

    req.requirement_text = payload.text

    # If you have ML prediction, uncomment:
    # if predict:
    #     pred, conf, probs = predict_category(payload.text)
    #     req.predicted_category = pred
    #     req.confidence = float(conf)
    #     req.probabilities_json = json.dumps(probs, ensure_ascii=False) if probs else None

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

    await ensure_project_owner(db, req.project_id, user.id)

    await db.delete(req)
    await db.commit()
    return {"status": "deleted", "id": requirement_id}
