from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from dotenv import load_dotenv
import os
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi import Request
import traceback
from .auth import router as auth_router, get_current_user
from .projects import router as projects_router
from .db import Base, engine, get_db
from .models import RequestLog, User, Project
from .schemas import TestCasesIn, RiskIn, RegressionIn, SummaryIn, AIOut, HistoryItem
from .ai import call_ai_json, prompt_testcases, prompt_risk, prompt_regression, prompt_summary
load_dotenv()

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


@app.get("/health")
def health():
    return {"status": "ok"}


async def ensure_project_owner(db: AsyncSession, project_id: int, user_id: int) -> Project:
    stmt = select(Project).where(Project.id == project_id, Project.owner_user_id == user_id)
    project = (await db.execute(stmt)).scalars().first()
    if not project:
        raise HTTPException(status_code=403, detail="Project not found or not owned by user")
    return project


async def _log_and_return(
    db: AsyncSession,
    project_id: int,
    endpoint: str,
    input_text: str,
    raw_text: str,
    parsed_json
) -> AIOut:
    db_obj = RequestLog(
        project_id=project_id,
        endpoint=endpoint,
        input_text=input_text,
        output_text=raw_text
    )
    db.add(db_obj)
    await db.commit()
    return AIOut(parsed_json=parsed_json, raw_text=raw_text)


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

    return await _log_and_return(
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

    return await _log_and_return(
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

    return await _log_and_return(
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

    return await _log_and_return(
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

@app.get("/api/history", response_model=list[HistoryItem])
async def history(
    project_id: int,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Ensure this user owns the project
    await ensure_project_owner(db, project_id, user.id)

    stmt = (
        select(RequestLog)
        .where(RequestLog.project_id == project_id)
        .order_by(desc(RequestLog.id))
        .limit(min(limit, 200))
    )
    rows = (await db.execute(stmt)).scalars().all()

    return [
        HistoryItem(
            id=r.id,
            project_id=r.project_id,
            endpoint=r.endpoint,
            created_at=str(r.created_at)
        )
        for r in rows
    ]
