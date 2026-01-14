from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from .db import get_db
from .models import User, Token
from .schemas import RegisterIn, LoginIn, TokenOut
from .security import hash_password, verify_password, new_token, expires_in_days, utc_now


router = APIRouter(prefix="/auth", tags=["auth"])

def _unauthorized(detail="Invalid or missing token"):
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> User:
    """
    Token auth: Authorization: Bearer <token>
    """
    if not authorization:
        _unauthorized("Missing Authorization header")

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        _unauthorized("Authorization header must be: Bearer <token>")

    token_value = parts[1].strip()
    if not token_value:
        _unauthorized()

    # Find token row
    stmt = select(Token).where(Token.token == token_value)
    token_row = (await db.execute(stmt)).scalars().first()
    if not token_row:
        _unauthorized("Token not found")

    # Check expiry
    if token_row.expires_at <= utc_now():
        # token expired -> delete it
        await db.execute(delete(Token).where(Token.token == token_value))
        await db.commit()
        _unauthorized("Token expired")

    # Load user
    user_stmt = select(User).where(User.id == token_row.user_id)
    user = (await db.execute(user_stmt)).scalars().first()
    if not user:
        _unauthorized("User not found")

    return user


@router.post("/register", response_model=TokenOut)
async def register(payload: RegisterIn, db: AsyncSession = Depends(get_db)):
    # Check if email exists
    exists = (await db.execute(select(User).where(User.email == payload.email))).scalars().first()
    if exists:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Create token (one active token per user; replace if exists)
    tok = new_token()
    exp = expires_in_days(7)

    # if a token already exists for user_id, delete it first (safety)
    await db.execute(delete(Token).where(Token.user_id == user.id))
    db.add(Token(user_id=user.id, token=tok, expires_at=exp))
    await db.commit()

    return TokenOut(token=tok, expires_at=exp.isoformat())


@router.post("/login", response_model=TokenOut)
async def login(payload: LoginIn, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.email == payload.email))).scalars().first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    tok = new_token()
    exp = expires_in_days(7)

    # Replace existing token for this user (1 active token per user)
    await db.execute(delete(Token).where(Token.user_id == user.id))
    db.add(Token(user_id=user.id, token=tok, expires_at=exp))
    await db.commit()

    return TokenOut(token=tok, expires_at=exp.isoformat())


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    # Delete the token used in this request
    token_value = authorization.split()[1].strip()
    await db.execute(delete(Token).where(Token.token == token_value))
    await db.commit()
    return {"status": "logged_out"}
