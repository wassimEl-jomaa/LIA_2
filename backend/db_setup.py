import asyncio
import os
import argparse
from dotenv import load_dotenv
from sqlalchemy import select, delete

from app.db import engine, AsyncSessionLocal, Base
from app.models import User, Project, Token
from app.security import hash_password, new_token, expires_in_days

load_dotenv()

DEMO_EMAIL = os.getenv("DEMO_EMAIL", "demo@lia.se")
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "Password123!")
DEMO_PROJECT_NAME = os.getenv("DEMO_PROJECT_NAME", "Noor QA Demo")


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_all_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def seed_demo_user_and_project():
    async with AsyncSessionLocal() as db:
        # 1) Ensure user exists
        user = (await db.execute(select(User).where(User.email == DEMO_EMAIL))).scalars().first()

        if not user:
            user = User(email=DEMO_EMAIL, hashed_password=hash_password(DEMO_PASSWORD))
            db.add(user)
            await db.commit()
            await db.refresh(user)
            print(f"✅ Created demo user: {DEMO_EMAIL}")
        else:
            print(f"ℹ️ Demo user already exists: {DEMO_EMAIL}")

        # 2) Replace token (one active token per user)
        await db.execute(delete(Token).where(Token.user_id == user.id))
        tok = new_token()
        exp = expires_in_days(7)
        db.add(Token(user_id=user.id, token=tok, expires_at=exp))
        await db.commit()
        print(f"✅ Demo token created (expires {exp.isoformat()})")
        print(f"🔑 TOKEN: {tok}")

        # 3) Ensure project exists for that user
        project = (
            await db.execute(
                select(Project).where(Project.name == DEMO_PROJECT_NAME, Project.owner_user_id == user.id)
            )
        ).scalars().first()

        if not project:
            project = Project(name=DEMO_PROJECT_NAME, owner_user_id=user.id)
            db.add(project)
            await db.commit()
            await db.refresh(project)
            print(f"✅ Created demo project: {DEMO_PROJECT_NAME} (id={project.id})")
        else:
            print(f"ℹ️ Demo project already exists: {DEMO_PROJECT_NAME} (id={project.id})")


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Drop all tables, recreate, and seed demo data")
    parser.add_argument("--seed", action="store_true", help="Only seed demo data (no drop)")
    args = parser.parse_args()

    if args.reset:
        print("⚠️ Reset enabled: dropping all tables...")
        await drop_all_tables()
        await create_tables()
        await seed_demo_user_and_project()
        print("✅ DB reset + seed done.")
        return

    # Default behaviour: create tables and seed
    await create_tables()
    await seed_demo_user_and_project()
    print("✅ DB setup done.")


if __name__ == "__main__":
    asyncio.run(main())

