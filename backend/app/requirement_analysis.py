from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Any

from .db import get_db
from .auth import get_current_user
from .permissions import ensure_project_access
from .models import Requirement, RequirementAnalysis
from .schemas import RequirementAnalysisCreateIn, RequirementAnalysisOut
from .ai import call_ai_json, prompt_requirement_analysis
from .ml import predict_category

router = APIRouter(prefix="/api/requirement_analyses", tags=["requirement_analyses"])


@router.post("", response_model=RequirementAnalysisOut)
async def create_requirement_analysis(
    payload: RequirementAnalysisCreateIn,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    # 1) Load requirement
    req = (
        await db.execute(select(Requirement).where(Requirement.id == payload.requirement_id))
    ).scalars().first()

    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")

    # 2) Access control (view is enough to analyze OR use allow_view=False if you want only editors)
    await ensure_project_access(db, req.project_id, user.id, allow_view=True)

    summary = payload.summary
    category = payload.category
    risk_level = payload.risk_level
    recommendations = payload.recommendations
    raw_json = None

    if not any([summary, category, risk_level, recommendations]):
        # 3) Generate analysis via AI from requirement text
        requirement_text = req.description or req.title
        user_prompt = prompt_requirement_analysis(requirement_text)
        raw, parsed = call_ai_json(user_prompt)
        raw_json = parsed if isinstance(parsed, dict) else {"raw_text": raw}

        # Extract fields from AI response
        if isinstance(parsed, dict):
            summary = parsed.get("summary") or summary

            # Derive risk_level from highest severity in risks
            risks = parsed.get("risks") or []
            severity_order = {"low": 1, "medium": 2, "high": 3, "critical": 4}
            max_sev = None
            max_score = 0
            for r in risks:
                sev = (r or {}).get("severity")
                score = severity_order.get(str(sev).lower(), 0)
                if score > max_score:
                    max_score = score
                    max_sev = str(sev).lower()
            risk_level = max_sev or risk_level

            # Recommendations from acceptance criteria suggestions (fallback to open questions)
            rec_list = parsed.get("acceptance_criteria_suggested") or parsed.get("open_questions") or []
            if rec_list:
                recommendations = "\n".join([f"- {item}" for item in rec_list if item])

        # Category from ML classifier (best-effort)
        try:
            pred, conf, _probs = predict_category(requirement_text)
            category = pred or category
        except Exception:
            pass

    # 4) Create analysis record
    analysis = RequirementAnalysis(
        requirement_id=req.id,
        created_by_user_id=user.id,
        summary=summary,
        category=category,
        risk_level=risk_level,
        recommendations=recommendations,
        raw_json=raw_json,
    )

    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    return analysis


@router.get("", response_model=list[RequirementAnalysisOut])
async def list_analyses_for_requirement(
    requirement_id: int,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    req = (await db.execute(select(Requirement).where(Requirement.id == requirement_id))).scalars().first()
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")

    await ensure_project_access(db, req.project_id, user.id, allow_view=True)

    limit = max(1, min(limit, 200))

    rows = (
        await db.execute(
            select(RequirementAnalysis)
            .where(RequirementAnalysis.requirement_id == requirement_id)
            .order_by(desc(RequirementAnalysis.id))
            .limit(limit)
        )
    ).scalars().all()

    return rows
