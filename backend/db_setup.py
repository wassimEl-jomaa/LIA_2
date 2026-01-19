import asyncio
import os
import argparse
import traceback
from dotenv import load_dotenv
from sqlalchemy import select, delete

from app.db import engine, AsyncSessionLocal, Base
from app.models import User, Project, Token, Role, Organization
from app.security import hash_password, new_token, expires_in_days

load_dotenv()

DEMO_EMAIL = os.getenv("DEMO_EMAIL", "demo@lia.se")
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "Password123!")
DEMO_PROJECT_NAME = os.getenv("DEMO_PROJECT_NAME", "Noor QA Demo")

DEMO_ROLE_NAME = os.getenv("DEMO_ROLE_NAME", "tester")
DEMO_ORG_NAME = os.getenv("DEMO_ORG_NAME", "Noor Engineering")
DEMO_USER_NAME = os.getenv("DEMO_USER_NAME", "Demo User")


async def create_tables():
    print("➡️ Creating tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Tables created/verified.")


async def drop_all_tables():
    print("➡️ Dropping all tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    print("✅ Tables dropped.")


async def _get_or_create_role(db, name: str, is_admin: bool = False) -> Role:
    role = (await db.execute(select(Role).where(Role.name == name))).scalars().first()
    if role:
        # Update is_admin flag if it changed
        if role.is_admin != is_admin:
            role.is_admin = is_admin
            await db.commit()
            await db.refresh(role)
            print(f"✅ Updated role: {role.name} (id={role.id}, is_admin={role.is_admin})")
        else:
            print(f"ℹ️ Role exists: {role.name} (id={role.id}, is_admin={role.is_admin})")
        return role

    role = Role(name=name, is_admin=is_admin)
    db.add(role)
    await db.commit()
    await db.refresh(role)
    print(f"✅ Created role: {role.name} (id={role.id}, is_admin={role.is_admin})")
    return role


async def _get_or_create_org(db, name: str) -> Organization:
    org = (await db.execute(select(Organization).where(Organization.name == name))).scalars().first()
    if org:
        print(f"ℹ️ Organization exists: {org.name} (id={org.id})")
        return org

    org = Organization(name=name)
    db.add(org)
    await db.commit()
    await db.refresh(org)
    print(f"✅ Created organization: {org.name} (id={org.id})")
    return org


async def seed_demo():
    print("➡️ Seeding demo data...")
    async with AsyncSessionLocal() as db:
        # 1) Roles
        admin_role = await _get_or_create_role(db, "admin", is_admin=True)
        tester_role = await _get_or_create_role(db, DEMO_ROLE_NAME, is_admin=False)

        # 2) Organization
        org = await _get_or_create_org(db, DEMO_ORG_NAME)

        # 3) User (ensure required NOT NULL fields are set)
        user = (await db.execute(select(User).where(User.email == DEMO_EMAIL))).scalars().first()
        if not user:
            user = User(
                email=DEMO_EMAIL,
                hashed_password=hash_password(DEMO_PASSWORD),
                name=DEMO_USER_NAME,          # required (NOT NULL)
                role_id=admin_role.id,        # pick admin for demo
                organization_id=org.id,       # if your model has it
                tel=None,
                address=None,
                city=None,
                country=None,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            print(f"✅ Created demo user: {user.email} (id={user.id})")
        else:
            # keep user in sync (optional)
            changed = False

            if getattr(user, "name", None) != DEMO_USER_NAME:
                user.name = DEMO_USER_NAME
                changed = True

            if getattr(user, "organization_id", None) != org.id:
                user.organization_id = org.id
                changed = True

            # make demo user admin (optional)
            if getattr(user, "role_id", None) != admin_role.id:
                user.role_id = admin_role.id
                changed = True

            if changed:
                await db.commit()
                await db.refresh(user)
                print(f"✅ Updated demo user: {user.email} (id={user.id})")
            else:
                print(f"ℹ️ Demo user exists: {user.email} (id={user.id})")

        # 4) Token (replace old token)
        await db.execute(delete(Token).where(Token.user_id == user.id))
        tok = new_token()
        exp = expires_in_days(7)
        db.add(Token(user_id=user.id, token=tok, expires_at=exp))
        await db.commit()
        print(f"✅ Demo token created (expires {exp.isoformat()})")
        print(f"🔑 TOKEN: {tok}")

        # 5) Project
        project = (
            await db.execute(
                select(Project).where(
                    Project.name == DEMO_PROJECT_NAME,
                    Project.owner_user_id == user.id
                )
            )
        ).scalars().first()

        if not project:
            project = Project(
                name=DEMO_PROJECT_NAME,
                description="Demo project for AI Test Assistant",
                organization_id=org.id,
                owner_user_id=user.id,
            )
            db.add(project)
            await db.commit()
            await db.refresh(project)
            print(f"✅ Created demo project: {project.name} (id={project.id})")
        else:
            print(f"ℹ️ Demo project exists: {project.name} (id={project.id})")

    print("✅ Seeding done.")


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Drop all tables, recreate, seed demo data")
    args = parser.parse_args()

    try:
        if args.reset:
            print("⚠️ Reset enabled")
            await drop_all_tables()

        await create_tables()
        await seed_demo()
        print("✅ DB setup done.")
    except Exception:
        print("❌ DB setup failed:")
        print(traceback.format_exc())
        raise


if __name__ == "__main__":
    asyncio.run(main())
