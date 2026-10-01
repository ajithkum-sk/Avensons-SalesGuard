"""Password hashing, JWT issuance, and reset-token helpers."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from .config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        return False


def create_access_token(user: dict) -> str:
    payload = {
        "sub": str(user["user_id"]),
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expires_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def new_reset_token() -> tuple[str, str, datetime]:
    """Returns (plain_token_for_email, sha256_hash_for_db, expires_at)."""
    plain = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(plain.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.reset_token_expires_minutes)
    return plain, token_hash, expires_at


def hash_reset_token(plain: str) -> str:
    return hashlib.sha256(plain.encode()).hexdigest()
