from datetime import datetime
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Any, List, Literal

# ---------- AUTH ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    name: str = Field(min_length=2, max_length=120)
    tel: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None

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
    description: Optional[str] = None
    organization: Optional[str] = None


class ProjectOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    organization: Optional[str] = None
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
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    group_name: Optional[str] = None


class RequestLogCreateIn(BaseModel):
    project_id: int
    endpoint: str
    input_text: str
    output_text: str


class RequestLogUpdateIn(BaseModel):
    input_text: Optional[str] = None
    output_text: Optional[str] = None

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

# ---------- ORGANIZATIONS ----------
class OrganizationCreateIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    org_number: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=120)
    country: str | None = Field(default=None, max_length=120)


class OrganizationUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    org_number: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=120)
    country: str | None = Field(default=None, max_length=120)


class OrganizationOut(BaseModel):
    id: int
    name: str
    org_number: str | None
    email: str | None
    phone: str | None
    address: str | None
    city: str | None
    country: str | None
    created_at: datetime
class RoleCreateIn(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    is_admin: bool = False

class RoleUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=50)
    is_admin: bool | None = None

class RoleOut(BaseModel):
    id: int
    name: str
    is_admin: bool
class UserOut(BaseModel):
    id: int
    email: EmailStr
    name: str
    tel: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    role_id: int
    organization_id: Optional[int] = None
    created_at: str

class UserCreateIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=2, max_length=120)

    tel: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None

    role_id: int
    organization_id: Optional[int] = None

class UserUpdateIn(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)

    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    tel: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None

    role_id: Optional[int] = None
    organization_id: Optional[int] = None
class RequirementPredictIn(BaseModel):
    text: str = Field(min_length=10)

class RequirementPredictOut(BaseModel):
    predicted_category: str
    confidence: float
    probabilities: dict[str, float]   
class RequirementCreateIn(BaseModel):
    project_id: int
    text: str = Field(min_length=10)
    # Optional test cases to create together with the requirement
    # Each item should include title, optional description, steps and expected_result
    test_cases: Optional[List[dict]] = None

class RequirementUpdateIn(BaseModel):
    text: str = Field(min_length=10)

class RequirementOut(BaseModel):
    id: int
    project_id: int
    requirement_text: str
    predicted_category: str
    confidence: float
    probabilities: Optional[dict[str, float]] = None
    # Optionally include created test cases when the requirement was created
    test_cases: Optional[List[dict]] = None
    created_at: str    

# ---------- GROUPS & PROJECT MEMBERS ----------
class GroupCreateIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)

class GroupOut(BaseModel):
    id: int
    name: str
    organization_id: Optional[int] = None
    created_at: Optional[str] = None
# ---------- GROUP MEMBERS & PROJECT MEMBERS ----------
class GroupMemberAddIn(BaseModel):
    user_id: int
class MemberUserOut(BaseModel):
    id: int
    email: EmailStr
    name: Optional[str] = None
    role_name: Optional[str] = None
    is_admin: bool = False
    groups: List[GroupOut] = []

    class Config:
        from_attributes = True

class ProjectMemberAddByEmailIn(BaseModel):
    email: EmailStr
    access_level: str = "viewer"  # viewer|editor
class AddProjectMemberIn(BaseModel):
    email: EmailStr
    access_level: Literal["viewer", "editor"] = "viewer"    
class ProjectMemberUpdateIn(BaseModel):
    access_level: str  # viewer | editor

class ProjectMemberOut(BaseModel):
    id: int
    project_id: int
    access_level: str  # viewer | editor

    # either user or group
    user_id: Optional[int] = None
    group_id: Optional[int] = None

    # enriched fields
    user: Optional[MemberUserOut] = None
    group: Optional[GroupOut] = None

    # badges
    is_owner: bool = False
    is_admin: bool = False

    class Config:
        from_attributes = True

class ProjectSharesOut(BaseModel):
    project_id: int
    users: List[ProjectMemberOut]
    groups: List[GroupOut]  # if later you add project_group table, include it here

class ProjectMemberAddByEmailIn(BaseModel):
    email: str  # ← This is the field name!
    access_level: str


# ---------- TEST CASES ----------
class TestCaseCreateIn(BaseModel):
    project_id: int
    title: str = Field(min_length=1)
    description: Optional[str] = None
    # steps can be submitted as a list of step strings
    steps: Optional[List[str]] = None
    expected_result: Optional[str] = None


class TestCaseOut(BaseModel):
    id: int
    project_id: int
    title: str
    description: Optional[str] = None
    steps: Optional[List[str]] = None
    expected_result: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    created_at: str


# ---------- TEST EXECUTIONS (Exekvering) ----------
class TestExecutionCreateIn(BaseModel):
    project_id: int
    test_case_id: int
    result: Literal["Passed", "Failed", "Blocked", "Skipped", "Pending"] = "Pending"
    notes: Optional[str] = None


class TestExecutionOut(BaseModel):
    id: int
    project_id: int
    test_case_id: int
    executed_by_user_id: Optional[int] = None
    result: str
    notes: Optional[str] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True