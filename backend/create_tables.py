"""
Script to create all database tables from SQLAlchemy models.
Run this from the backend directory:
    python create_tables.py
"""

import asyncio
from app.db import engine, Base
from app.models import (
    Organization, Project, Group, GroupMember,
    ProjectMember, ProjectGroupMember, Role, User,
    Requirement, RequirementAnalysis, TestCase, TestRun,
    TestExecution, ClassifyRequirement, BugReport,
    BugStatusHistory, BugRetest, Token
)


async def create_all_tables():
    """Create all tables defined in the models."""
    print("🔄 Creating database tables...")
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    print("✅ All tables created successfully!")
    print("\n📋 Created tables:")
    print("  - organizations")
    print("  - projects")
    print("  - groups")
    print("  - group_members")
    print("  - project_members")
    print("  - project_group_members")
    print("  - roles")
    print("  - users")
    print("  - tokens")
    print("  - requirements")
    print("  - requirement_analyses")
    print("  - test_cases")
    print("  - test_runs")
    print("  - test_executions")
    print("  - classify_requirements")
    print("  - bug_reports")
    print("  - bug_status_history ✨ (NEW - tracks status changes)")
    print("  - bug_retests ✨ (NEW - tracks retest executions)")


if __name__ == "__main__":
    asyncio.run(create_all_tables())
