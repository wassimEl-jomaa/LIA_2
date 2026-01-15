from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Any

# ---------- AUTH ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    # NEW user profile fields
    name: str = Field(min_length=2, max_length=150, default="New User")
    tel: Optional[str] = Field(default=None, max_length=50)
    address: Optional[str] = Field(default=None, max_length=255)
    city: Optional[str] = Field(default=None, max_length=120)
    country: Optional[str] = Field(default=None, max_length=120)

    # NEW role / org
    role_id: Optional[int] = None           # if None -> backend sets default role (tester)
    organization_id: Optional[int] = None   # optional in MVP


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
    description: Optional[str] = Field(default=None, max_length=255)
    organization_id: Optional[int] = None


class ProjectOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    organization_id: Optional[int] = None
    owner_user_id: int
    created_at: str


# ---------- AI INPUTS ----------
class BaseIn(BaseModel):
    project_id: int = Field(..., description="Owned project id")


class TestCasesIn(BaseIn):
    requirement: str = Field(min_length=5)


class RiskIn(BaseIn):
    requirement: str = Field(min_length=5)


class RegressionIn(BaseIn):
    change_description: str = Field(min_length=5)
    changed_components: Optional[list[str]] = None
class RequestLogOut(BaseModel):
    id: int
    project_id: int
    endpoint: str
    input_text: str
    output_text: str
    created_at: str

class SummaryIn(BaseIn):
    test_results: str = Field(min_length=5)
    bug_reports: Optional[str] = None


# ---------- AI OUTPUT ----------
class AIOut(BaseModel):
    parsed_json: Optional[Any] = None
    raw_text: str


# ---------- HISTORY ----------
class HistoryItem(BaseModel):
    id: int
    project_id: int
    endpoint: str
    created_at: str
# ---------- USER ----------
class UserMeOut(BaseModel):
    id: int
    email: str
    name: str
    role_id: int | None = None
    organization_id: int | None = None
    created_at: str
