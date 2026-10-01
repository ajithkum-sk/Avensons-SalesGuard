"""Shared FastAPI dependencies: JWT verification and role guards."""
from fastapi import Header, HTTPException

from . import auth_utils
from .db import fetch_one


def get_current_user(authorization: str | None = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = auth_utils.decode_access_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = fetch_one(
        "SELECT user_id, full_name, role, salesman_key, is_active, email "
        "FROM sg.app_user WHERE user_id = %s",
        [int(payload["sub"])],
    )
    if not user or not user["is_active"]:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


def require_salesman(authorization: str | None = Header(None)) -> dict:
    user = get_current_user(authorization)
    if user["role"] != "salesman" or user["salesman_key"] is None:
        raise HTTPException(status_code=403, detail="Salesperson access only")
    return user


def require_super_admin(authorization: str | None = Header(None)) -> dict:
    user = get_current_user(authorization)
    if user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access only")
    return user
