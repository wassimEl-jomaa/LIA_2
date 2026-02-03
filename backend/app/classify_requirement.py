from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.auth import get_current_user
from app.models import ClassifyRequirement, Requirement
from app.schemas import (
    ClassifyRequirementCreate,
    ClassifyRequirementOut,
    ClassifyRequirementGenerateRequest,
    ClassifyRequirementGenerateResponse,
    DashboardRiskCountsOut,
    RequirementLatestClassificationOut,
)
from app.ai import generate_classification_and_store



router = APIRouter(prefix="/api/classify_requirements", tags=["ClassifyRequirements"])


@router.post("", response_model=ClassifyRequirementOut)
def create_manual(
    payload: ClassifyRequirementCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    row = ClassifyRequirement(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("", response_model=list[ClassifyRequirementOut])
async def list_classifications(
    project_id: int = Query(...),
    requirement_id: int | None = Query(default=None),
    risk_level: str | None = Query(default=None),
    category: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    stmt = select(ClassifyRequirement).where(ClassifyRequirement.project_id == project_id)
    if requirement_id is not None:
        stmt = stmt.where(ClassifyRequirement.requirement_id == requirement_id)
    if risk_level:
        stmt = stmt.where(ClassifyRequirement.risk_level == risk_level)
    if category:
        stmt = stmt.where(ClassifyRequirement.category == category)

    stmt = stmt.order_by(ClassifyRequirement.created_at.desc()).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()
    return rows


@router.post("/generate", response_model=ClassifyRequirementGenerateResponse)
async def generate(
    req: ClassifyRequirementGenerateRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    row = await generate_classification_and_store(
        db=db,
        project_id=req.project_id,
        requirement_id=req.requirement_id,
        force=req.force,
        include_recommendations=req.include_recommendations,
    )
    return ClassifyRequirementGenerateResponse(
        classification=ClassifyRequirementOut.model_validate(row)
    )


@router.get("/latest", response_model=list[RequirementLatestClassificationOut])
async def latest_per_requirement(
    project_id: int = Query(...),
    limit: int = Query(default=200, ge=1, le=1000),
    risk_level: str | None = Query(default=None),
    category: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    # latest created_at per requirement
    sub = (
        select(
            ClassifyRequirement.requirement_id.label("req_id"),
            func.max(ClassifyRequirement.created_at).label("max_created_at"),
        )
        .where(ClassifyRequirement.project_id == project_id)
        .group_by(ClassifyRequirement.requirement_id)
        .subquery()
    )

    stmt = (
        select(
            ClassifyRequirement.requirement_id,
            Requirement.title.label("requirement_title"),
            ClassifyRequirement.category,
            ClassifyRequirement.risk_level,
            ClassifyRequirement.confidence,
            ClassifyRequirement.created_at,
            ClassifyRequirement.summary,
            ClassifyRequirement.recommendations,
        )
        .join(
            sub,
            and_(
                ClassifyRequirement.requirement_id == sub.c.req_id,
                ClassifyRequirement.created_at == sub.c.max_created_at,
            ),
        )
        .join(Requirement, Requirement.id == ClassifyRequirement.requirement_id)
        .where(ClassifyRequirement.project_id == project_id)
        .order_by(desc(ClassifyRequirement.created_at))
    )

    if risk_level:
        stmt = stmt.where(ClassifyRequirement.risk_level == risk_level)
    if category:
        stmt = stmt.where(ClassifyRequirement.category == category)

    rows = (await db.execute(stmt.limit(limit))).all()

    return [
        RequirementLatestClassificationOut(
            requirement_id=r.requirement_id,
            requirement_title=r.requirement_title,
            category=r.category,
            risk_level=r.risk_level,
            confidence=r.confidence,
            created_at=r.created_at,
            summary=r.summary,
            recommendations=r.recommendations,
        )
        for r in rows
    ]


@router.get("/dashboard/risk_counts", response_model=DashboardRiskCountsOut)
async def dashboard_risk_counts(
    project_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    # latest per requirement
    sub = (
        select(
            ClassifyRequirement.requirement_id.label("req_id"),
            func.max(ClassifyRequirement.created_at).label("max_created_at"),
        )
        .where(ClassifyRequirement.project_id == project_id)
        .group_by(ClassifyRequirement.requirement_id)
        .subquery()
    )

    stmt = (
        select(ClassifyRequirement.risk_level, func.count().label("cnt"))
        .join(
            sub,
            and_(
                ClassifyRequirement.requirement_id == sub.c.req_id,
                ClassifyRequirement.created_at == sub.c.max_created_at,
            ),
        )
        .where(ClassifyRequirement.project_id == project_id)
        .group_by(ClassifyRequirement.risk_level)
    )

    grouped = (await db.execute(stmt)).all()

    counts = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    total = 0
    for risk, cnt in grouped:
        if risk in counts:
            counts[risk] = int(cnt)
            total += int(cnt)

    return DashboardRiskCountsOut(project_id=project_id, total=total, **counts)
