from sqlalchemy import String, Text, DateTime, func, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base

# =========================
# USERS
# =========================
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    created_at: Mapped[str] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    projects = relationship("Project", back_populates="owner", cascade="all, delete")
    token = relationship("Token", back_populates="user", uselist=False, cascade="all, delete")


# =========================
# TOKENS (AUTH)
# =========================
class Token(Base):
    __tablename__ = "tokens"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        index=True
    )

    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    expires_at: Mapped[str] = mapped_column(DateTime(timezone=True), nullable=False)

    user = relationship("User", back_populates="token")


# =========================
# PROJECTS
# =========================
class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)

    owner_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    created_at: Mapped[str] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    owner = relationship("User", back_populates="projects")
    logs = relationship("RequestLog", back_populates="project", cascade="all, delete")


# =========================
# REQUEST LOGS (AI HISTORY)
# =========================
class RequestLog(Base):
    __tablename__ = "request_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    endpoint: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    input_text: Mapped[str] = mapped_column(Text, nullable=False)
    output_text: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[str] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True
    )

    project = relationship("Project", back_populates="logs")

