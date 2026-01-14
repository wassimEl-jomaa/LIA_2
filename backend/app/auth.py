from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from .db import get_db
from .models import User, Token
from .schemas import RegisterIn, LoginIn, TokenOut
from .security import hash_password, verify_password, new_token, expires_in_days, utc_now

router = APIRouter(prefix="/auth", tags=["auth"])

bearer_scheme = HTTPBearer(auto_error=False)

def _unauthorized(detail="Invalid or missing token"):
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> User:
    """
    Token auth: Authorization: Bearer <token>
    Creates Swagger 'Authorize' button automatically.
    """
    if creds is None or not creds.credentials:
        _unauthorized("Missing or invalid Authorization header")

    token_value = creds.credentials.strip()

    stmt = select(Token).where(Token.token == token_value)
    token_row = (await db.execute(stmt)).scalars().first()
    if not token_row:
        _unauthorized("Token not found")

    if token_row.expires_at <= utc_now():
        await db.execute(delete(Token).where(Token.token == token_value))
        await db.commit()
        _unauthorized("Token expired")

    user_stmt = select(User).where(User.id == token_row.user_id)
    user = (await db.execute(user_stmt)).scalars().first()
    if not user:
        _unauthorized("User not found")

    return user


@router.post("/register", response_model=TokenOut)
async def register(payload: RegisterIn, db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(select(User).where(User.email == payload.email))).scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(email=payload.email, hashed_password=hash_password(payload.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)

    tok = new_token()
    exp = expires_in_days(7)

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

    await db.execute(delete(Token).where(Token.user_id == user.id))
    db.add(Token(user_id=user.id, token=tok, expires_at=exp))
    await db.commit()

    return TokenOut(token=tok, expires_at=exp.isoformat())


@router.post("/logout")
async def logout(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    if creds is None or not creds.credentials:
        _unauthorized("Missing Authorization header")

    token_value = creds.credentials.strip()
    await db.execute(delete(Token).where(Token.token == token_value))
    await db.commit()
    return {"status": "logged_out"}
