from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from dotenv import load_dotenv
import os
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi import Request
import traceback
from .auth import router as auth_router, get_current_user
from .projects import router as projects_router
from .db import Base, engine, get_db
from .organizations import router as organizations_router
from .roles import router as roles_router
from .users import router as users_router
from .requirement import router as requirements_router
from .test_cases import router as test_cases_router
from .groups import router as groups_router
from .project_sharing import router as project_sharing_router
from .ml import predict_category
from .schemas import RequirementPredictIn, RequirementPredictOut
from .models import User, Project
from .models import Requirement
from .schemas import RequirementCreateIn, RequirementUpdateIn, RequirementOut
from .schemas import TestCasesIn, RiskIn, RegressionIn, SummaryIn, AIOut, HistoryItem
from .ai import call_ai_json, prompt_testcases, prompt_risk, prompt_regression, prompt_summary
from .request_logs import router as request_logs_router, log_and_return

# Load .env from backend/ directory (one level up from app/)
env_path = Path(__file__).parent.parent / ".env"
print(f"[ENV] Loading .env from: {env_path}")
print(f"[ENV] .env exists: {env_path.exists()}")
load_dotenv(dotenv_path=env_path, override=True)
print(f"[ENV] OPENAI_API_KEY length after load: {len(os.getenv('OPENAI_API_KEY', ''))}")
print(f"[ENV] OPENAI_MODEL after load: {os.getenv('OPENAI_MODEL', 'NOT SET')}")

app = FastAPI(title="AI Assistant for Testers (Noor Engineering MVP)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(projects_router)  # requires projects.py
app.include_router(organizations_router)
app.include_router(roles_router)
app.include_router(users_router)
app.include_router(requirements_router) # requires requirement.py
app.include_router(groups_router)
app.include_router(project_sharing_router)
app.include_router(test_cases_router)
app.include_router(request_logs_router)
# DEBUG: show full traceback in Swagger when 500 happens
@app.exception_handler(Exception)
async def debug_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    print(tb)  # prints in terminal
    return PlainTextResponse(tb, status_code=500)


@app.on_event("startup")
async def on_startup():
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    if not os.getenv("OPENAI_API_KEY"):
        print("WARNING: OPENAI_API_KEY is not set. Endpoints will fail until it is set.")

@app.post("/api/requirements/predict", response_model=RequirementPredictOut)
async def predict_requirement_category(
    payload: RequirementPredictIn,
    user: User = Depends(get_current_user),
):
    # user must be logged in (token auth)
    pred, conf, probs = predict_category(payload.text)
    return RequirementPredictOut(
        predicted_category=pred,
        confidence=conf,
        probabilities=probs,
    )
@app.get("/health")
def health():
    return {"status": "ok"}


async def ensure_project_owner(db: AsyncSession, project_id: int, user_id: int) -> Project:
    stmt = select(Project).where(Project.id == project_id, Project.owner_user_id == user_id)
    project = (await db.execute(stmt)).scalars().first()
    if not project:
        raise HTTPException(status_code=403, detail="Project not found or not owned by user")
    return project


# RequestLog handling moved to `request_logs.py` (use `log_and_return`)


def _require_openai_key():
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")


# =========================
# PROTECTED AI ENDPOINTS
# =========================

@app.post("/api/testcases", response_model=AIOut)
async def make_testcases(
    payload: TestCasesIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_openai_key()
    await ensure_project_owner(db, payload.project_id, user.id)

    user_prompt = prompt_testcases(payload.requirement)
    raw, parsed = call_ai_json(user_prompt)

    return await log_and_return(
        db=db,
        project_id=payload.project_id,
        endpoint="testcases",
        input_text=payload.requirement,
        raw_text=raw,
        parsed_json=parsed
    )


@app.post("/api/risk", response_model=AIOut)
async def analyze_risk(
    payload: RiskIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_openai_key()
    await ensure_project_owner(db, payload.project_id, user.id)

    user_prompt = prompt_risk(payload.requirement)
    raw, parsed = call_ai_json(user_prompt)

    return await log_and_return(
        db=db,
        project_id=payload.project_id,
        endpoint="risk",
        input_text=payload.requirement,
        raw_text=raw,
        parsed_json=parsed
    )


@app.post("/api/regression", response_model=AIOut)
async def suggest_regression(
    payload: RegressionIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_openai_key()
    await ensure_project_owner(db, payload.project_id, user.id)

    input_text = payload.change_description
    if payload.changed_components:
        input_text += "\n\nCHANGED_COMPONENTS:\n" + "\n".join(payload.changed_components)

    user_prompt = prompt_regression(payload.change_description, payload.changed_components)
    raw, parsed = call_ai_json(user_prompt)

    return await log_and_return(
        db=db,
        project_id=payload.project_id,
        endpoint="regression",
        input_text=input_text,
        raw_text=raw,
        parsed_json=parsed
    )


@app.post("/api/summary", response_model=AIOut)
async def summarize(
    payload: SummaryIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_openai_key()
    await ensure_project_owner(db, payload.project_id, user.id)

    input_text = payload.test_results
    if payload.bug_reports:
        input_text += "\n\nBUG_REPORTS:\n" + payload.bug_reports

    user_prompt = prompt_summary(payload.test_results, payload.bug_reports)
    raw, parsed = call_ai_json(user_prompt)

    return await log_and_return(
        db=db,
        project_id=payload.project_id,
        endpoint="summary",
        input_text=input_text,
        raw_text=raw,
        parsed_json=parsed
    )


# =========================
# PROTECTED HISTORY
# =========================

# History endpoints moved to `request_logs.py`