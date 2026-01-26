from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from .db import get_db
from .models import RequestLog, Project
from .schemas import RequestLogOut, HistoryItem, RequestLogCreateIn, RequestLogUpdateIn, AIOut
from .auth import get_current_user

router = APIRouter()


async def ensure_project_owner(db: AsyncSession, project_id: int, user_id: int) -> Project:
    stmt = select(Project).where(Project.id == project_id, Project.owner_user_id == user_id)
    project = (await db.execute(stmt)).scalars().first()
    if not project:
        raise HTTPException(status_code=403, detail="Project not found or not owned by user")
    return project


async def log_and_return(
    db: AsyncSession,
    project_id: int,
    endpoint: str,
    input_text: str,
    raw_text: str,
    parsed_json,
):
    db_obj = RequestLog(
        project_id=project_id,
        endpoint=endpoint,
        input_text=input_text,
        output_text=raw_text,
    )
    db.add(db_obj)
    await db.commit()
    return AIOut(parsed_json=parsed_json, raw_text=raw_text)


@router.get("/api/history", response_model=list[HistoryItem])
async def history(
    project_id: int,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user),
):
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
            created_at=str(r.created_at),
        )
        for r in rows
    ]


@router.get("/api/history/{log_id}", response_model=RequestLogOut)
async def history_detail(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user),
):
    log = (await db.execute(select(RequestLog).where(RequestLog.id == log_id))).scalars().first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")

    project = (await db.execute(select(Project).where(Project.id == log.project_id))).scalars().first()
    if not project or project.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    return RequestLogOut(
        id=log.id,
        project_id=log.project_id,
        endpoint=log.endpoint,
        input_text=log.input_text,
        output_text=log.output_text,
        created_at=str(log.created_at),
    )


@router.post("/api/request_logs", response_model=RequestLogOut)
async def create_request_log(
    payload: RequestLogCreateIn,
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user),
):
    await ensure_project_owner(db, payload.project_id, user.id)

    db_obj = RequestLog(
        project_id=payload.project_id,
        endpoint=payload.endpoint,
        input_text=payload.input_text,
        output_text=payload.output_text,
    )
    db.add(db_obj)
    await db.commit()
    return RequestLogOut(
        id=db_obj.id,
        project_id=db_obj.project_id,
        endpoint=db_obj.endpoint,
        input_text=db_obj.input_text,
        output_text=db_obj.output_text,
        created_at=str(db_obj.created_at),
    )


@router.put("/api/request_logs/{log_id}", response_model=RequestLogOut)
async def update_request_log(
    log_id: int,
    payload: RequestLogUpdateIn,
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user),
):
    log = (await db.execute(select(RequestLog).where(RequestLog.id == log_id))).scalars().first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")

    project = (await db.execute(select(Project).where(Project.id == log.project_id))).scalars().first()
    if not project or project.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    if payload.input_text is not None:
        log.input_text = payload.input_text
    if payload.output_text is not None:
        log.output_text = payload.output_text

    db.add(log)
    await db.commit()

    return RequestLogOut(
        id=log.id,
        project_id=log.project_id,
        endpoint=log.endpoint,
        input_text=log.input_text,
        output_text=log.output_text,
        created_at=str(log.created_at),
    )


@router.delete("/api/request_logs/{log_id}")
async def delete_request_log(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user),
):
    log = (await db.execute(select(RequestLog).where(RequestLog.id == log_id))).scalars().first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")

    project = (await db.execute(select(Project).where(Project.id == log.project_id))).scalars().first()
    if not project or project.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    await db.delete(log)
    await db.commit()

    return {"deleted": True}
