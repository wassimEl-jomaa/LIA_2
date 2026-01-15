import asyncio
import os
import argparse
import traceback
from dotenv import load_dotenv
from sqlalchemy import select, delete
from app.models import Role, Organization
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


async def seed_demo():
    print("➡️ Seeding demo data...")
    async with AsyncSessionLocal() as db:
                # Roles (create admin + tester)
        admin_role = (await db.execute(select(Role).where(Role.name == "admin"))).scalars().first()
        if not admin_role:
            admin_role = Role(name="admin", is_admin=True)
            db.add(admin_role)
            await db.commit()
            await db.refresh(admin_role)
            print(f"✅ Created role: {admin_role.name} (id={admin_role.id})")
        else:
            print(f"ℹ️ Role exists: {admin_role.name} (id={admin_role.id})")

        tester_role = (await db.execute(select(Role).where(Role.name == DEMO_ROLE_NAME))).scalars().first()
        if not tester_role:
            tester_role = Role(name=DEMO_ROLE_NAME, is_admin=False)
            db.add(tester_role)
            await db.commit()
            await db.refresh(tester_role)
            print(f"✅ Created role: {tester_role.name} (id={tester_role.id})")
        else:
            if user.role_id != admin_role.id:
                user.role_id = admin_role.id
                await db.commit()
                print("✅ Updated demo user role to admin")


        # Organization
        org = (await db.execute(select(Organization).where(Organization.name == DEMO_ORG_NAME))).scalars().first()
        if not org:
            org = Organization(name=DEMO_ORG_NAME)
            db.add(org)
            await db.commit()
            await db.refresh(org)
            print(f"✅ Created organization: {org.name} (id={org.id})")
        else:
            print(f"ℹ️ Organization exists: {org.name} (id={org.id})")

        # User
        user = (await db.execute(select(User).where(User.email == DEMO_EMAIL))).scalars().first()
        if not user:
            user = User(
                email=DEMO_EMAIL,
                hashed_password=hash_password(DEMO_PASSWORD),
                name=DEMO_USER_NAME,
                role_id=admin_role.id,
                organization_id=org.id,
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
            print(f"ℹ️ Demo user exists: {user.email} (id={user.id})")

        # Token (replace)
        await db.execute(delete(Token).where(Token.user_id == user.id))
        tok = new_token()
        exp = expires_in_days(7)
        db.add(Token(user_id=user.id, token=tok, expires_at=exp))
        await db.commit()
        print(f"✅ Demo token created (expires {exp.isoformat()})")
        print(f"🔑 TOKEN: {tok}")

        # Project
        project = (
            await db.execute(
                select(Project).where(Project.name == DEMO_PROJECT_NAME, Project.owner_user_id == user.id)
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



