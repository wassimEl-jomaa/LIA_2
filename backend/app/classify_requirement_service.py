from sqlalchemy.orm import Session
from sqlalchemy import desc
from fastapi import HTTPException

from app.models import Requirement, ClassifyRequirement

RISK_LEVELS = {"low", "medium", "high", "critical"}

def build_prompt(req: Requirement, include_recommendations: bool) -> str:
    return f"""
You are a senior QA analyst.

Classify the requirement and return STRICT JSON only:
{{
  "category": "functional|security|performance|usability|reliability|other",
  "risk_level": "low|medium|high|critical",
  "confidence": 0.0-1.0,
  "summary": "...",
  "reasoning": "...",
  {"\"recommendations\": \"...\", " if include_recommendations else ""}
}}

Requirement title: {req.title}
Requirement description: {req.description}
Acceptance criteria: {req.acceptance_criteria or ""}
""".strip()

def normalize(data: dict) -> dict:
    risk = (data.get("risk_level") or "").lower().strip()
    if risk not in RISK_LEVELS:
        risk = "medium"
    category = (data.get("category") or "functional").strip()[:100]

    confidence = data.get("confidence")
    if isinstance(confidence, (int, float)):
        confidence = max(0.0, min(1.0, float(confidence)))
    else:
        confidence = None

    return {
        "category": category,
        "risk_level": risk,
        "confidence": confidence,
        "summary": data.get("summary"),
        "reasoning": data.get("reasoning"),
        "recommendations": data.get("recommendations"),
    }

def generate_classification_and_store(
    db: Session,
    project_id: int,
    requirement_id: int,
    force: bool,
    include_recommendations: bool,
) -> ClassifyRequirement:
    req = (
        db.query(Requirement)
        .filter(Requirement.id == requirement_id, Requirement.project_id == project_id)
        .first()
    )
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found in project")

    if not force:
        latest = (
            db.query(ClassifyRequirement)
            .filter(ClassifyRequirement.requirement_id == requirement_id)
            .order_by(desc(ClassifyRequirement.created_at))
            .first()
        )
        if latest:
            return latest

    prompt = build_prompt(req, include_recommendations)

    # ✅ Use YOUR existing AI function here.
    # Replace this import/call with whatever you already use to call AI.
    from app.ai import run_ai_json  # <-- adjust to your project
    parsed_json, model_name = run_ai_json(prompt)

    if not isinstance(parsed_json, dict):
        raise HTTPException(status_code=502, detail="AI returned invalid JSON")

    clean = normalize(parsed_json)

    row = ClassifyRequirement(
        project_id=project_id,
        requirement_id=requirement_id,
        category=clean["category"],
        risk_level=clean["risk_level"],
        confidence=clean["confidence"],
        summary=clean["summary"],
        reasoning=clean["reasoning"],
        recommendations=clean["recommendations"],
        raw_json=parsed_json,
        model_name=model_name,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
