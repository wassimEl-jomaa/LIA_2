# app/import_export.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, Literal, Optional
import io
import json

from .db import get_db
from .auth import get_current_user
from .permissions import ensure_project_access
from .services.impexp import (
    export_requirements_bytes,
    export_test_cases_bytes,
    import_requirements_from_upload,
)

router = APIRouter(prefix="/api/projects", tags=["import_export"])

ExportFormat = Literal["csv", "xlsx", "json", "yaml"]
Entity = Literal["requirements", "test_cases"]
ImportMode = Literal["create_only", "upsert_external_id"]
OnErrorMode = Literal["stop", "continue"]


def _filename(project_id: int, entity: str, fmt: str) -> str:
    ext = "xlsx" if fmt == "xlsx" else fmt
    return f"project_{project_id}_{entity}.{ext}"


@router.get("/{project_id}/export/{entity}")
async def export_entity(
    project_id: int,
    entity: Entity,
    format: ExportFormat = Query("csv"),
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    await ensure_project_access(db, project_id, user.id, allow_view=True)

    if entity == "requirements":
        content, media_type = await export_requirements_bytes(db, project_id, format)
    else:
        content, media_type = await export_test_cases_bytes(db, project_id, format)

    file_like = io.BytesIO(content)
    filename = _filename(project_id, entity, format)

    return StreamingResponse(
        file_like,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{project_id}/import/requirements")
async def import_requirements(
    project_id: int,
    file: UploadFile = File(...),

    # format kan vara auto, eller hårt satt
    format: Literal["auto", "csv", "xlsx", "json", "yaml"] = Query("auto"),
    mode: ImportMode = Query("upsert_external_id"),
    dry_run: bool = Query(True),
    on_error: OnErrorMode = Query("continue"),

    # mapping skickas som JSON-string (valfritt)
    # ex: {"title":"Requirement title","external_id":"ID","tags":"Labels"}
    mapping_json: Optional[str] = Form(None),

    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    await ensure_project_access(db, project_id, user.id, allow_view=False)

    mapping = None
    if mapping_json:
        try:
            mapping = json.loads(mapping_json)
            if not isinstance(mapping, dict):
                raise ValueError("mapping_json must be an object")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid mapping_json: {e}")

    result = await import_requirements_from_upload(
        db=db,
        project_id=project_id,
        upload=file,
        declared_format=format,
        mode=mode,
        dry_run=dry_run,
        on_error=on_error,
        mapping=mapping,
        user_id=user.id,
    )
    return result
