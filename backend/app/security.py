import secrets
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)

def new_token() -> str:
    # URL-safe random token
    return secrets.token_urlsafe(32)

def utc_now():
    return datetime.now(timezone.utc)

def expires_in_days(days: int):
    return utc_now() + timedelta(days=days)