from pydantic import BaseModel, Field
from typing import Optional, Any, List
from pydantic import BaseModel, EmailStr, Field
from pydantic import EmailStr
from typing import Optional

# ---------- AUTH ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TokenOut(BaseModel):
    token: str
    token_type: str = "Bearer"
    expires_at: str

# ---------- PROJECTS ----------
class ProjectCreateIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)

class ProjectOut(BaseModel):
    id: int
    name: str
    owner_user_id: int
    created_at: str

class BaseIn(BaseModel):
    project_id: int = Field(..., description="Owned project id")

class TestCasesIn(BaseIn):
    requirement: str = Field(min_length=5)

class RiskIn(BaseIn):
    requirement: str = Field(min_length=5)

class RegressionIn(BaseIn):
    change_description: str = Field(min_length=5)
    changed_components: list[str] | None = None

class SummaryIn(BaseIn):
    test_results: str = Field(min_length=5)
    bug_reports: str | None = None

class AIOut(BaseModel):
    # We return both parsed_json (when possible) and raw_text (always)
    parsed_json: Optional[Any] = None
    raw_text: str

class HistoryItem(BaseModel):
    id: int
    project_id: int
    endpoint: str
    created_at: str
