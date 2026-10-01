"""Super-admin: user management."""
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query

from .. import auth_utils
from ..db import execute, fetch_all, fetch_one
from ..deps import require_super_admin
from ..schemas import AdminUserIn, AdminUserUpdateIn, SetActiveIn

router = APIRouter(prefix="/api/admin", tags=["admin"])

# frontend role names -> db role names (sg.app_user.role check constraint)
FRONTEND_TO_DB_ROLE = {"superadmin": "super_admin", "manager": "manager", "salesperson": "salesman"}
DB_TO_FRONTEND_ROLE = {v: k for k, v in FRONTEND_TO_DB_ROLE.items()}


def _to_public(u: dict) -> dict:
    return {
        "user_id": u["user_id"],
        "name": u["full_name"],
        "email": u["email"],
        "role": DB_TO_FRONTEND_ROLE.get(u["role"], u["role"]),
        "employee_id": u["employee_id"],
        "phone": u["phone"],
        "active": u["is_active"],
    }


def _slug_username(name: str) -> str:
    base = "".join(c for c in name.lower() if c.isalnum()) or "user"
    return base


@router.get("/overview")
def overview(_: dict = Depends(require_super_admin)):
    row = fetch_one(
        "SELECT count(*) AS total_users, "
        "count(*) FILTER (WHERE role = 'manager') AS managers, "
        "count(*) FILTER (WHERE role = 'salesman') AS salespeople, "
        "count(*) FILTER (WHERE NOT is_active) AS deactivated "
        "FROM sg.app_user"
    )
    return row


@router.get("/users")
def list_users(
    _: dict = Depends(require_super_admin),
    limit: int = Query(10, le=100),
    offset: int = Query(0, ge=0),
    search: str | None = None,
    role: str | None = None,
):
    conditions = []
    params: list = []
    if search:
        conditions.append("(full_name ILIKE %s OR email ILIKE %s)")
        params += [f"%{search}%", f"%{search}%"]
    if role and role != "all":
        db_role = FRONTEND_TO_DB_ROLE.get(role, role)
        conditions.append("role = %s")
        params.append(db_role)
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    total = fetch_one(f"SELECT count(*) AS n FROM sg.app_user {where}", params)["n"]
    rows = fetch_all(
        f"SELECT user_id, full_name, email, role, employee_id, phone, is_active "
        f"FROM sg.app_user {where} ORDER BY full_name LIMIT %s OFFSET %s",
        params + [limit, offset],
    )
    return {"total": total, "rows": [_to_public(r) for r in rows]}


@router.post("/users")
def create_user(body: AdminUserIn, _: dict = Depends(require_super_admin)):
    existing = fetch_one("SELECT user_id FROM sg.app_user WHERE lower(email) = lower(%s)", [body.email])
    if existing:
        raise HTTPException(400, "A user with that email already exists")

    db_role = FRONTEND_TO_DB_ROLE[body.role]
    temp_password = secrets.token_urlsafe(6)
    password_hash = auth_utils.hash_password(temp_password)
    username = _slug_username(body.name)

    row = fetch_one(
        "INSERT INTO sg.app_user (username, full_name, role, email, password_hash, "
        "employee_id, phone, is_active) VALUES (%s,%s,%s,%s,%s,%s,%s,true) RETURNING *",
        [username, body.name, db_role, body.email, password_hash, body.employee_id, body.phone],
    )
    return {**_to_public(row), "temp_password": temp_password}


@router.patch("/users/{user_id}")
def update_user(user_id: int, body: AdminUserUpdateIn, _: dict = Depends(require_super_admin)):
    current = fetch_one("SELECT * FROM sg.app_user WHERE user_id = %s", [user_id])
    if not current:
        raise HTTPException(404, "User not found")

    db_role = FRONTEND_TO_DB_ROLE.get(body.role) if body.role else current["role"]
    execute(
        "UPDATE sg.app_user SET full_name = %s, role = %s, employee_id = %s, phone = %s "
        "WHERE user_id = %s",
        [
            body.name or current["full_name"],
            db_role,
            body.employee_id if body.employee_id is not None else current["employee_id"],
            body.phone if body.phone is not None else current["phone"],
            user_id,
        ],
    )
    row = fetch_one("SELECT * FROM sg.app_user WHERE user_id = %s", [user_id])
    return _to_public(row)


@router.patch("/users/{user_id}/active")
def set_user_active(user_id: int, body: SetActiveIn, _: dict = Depends(require_super_admin)):
    n = execute("UPDATE sg.app_user SET is_active = %s WHERE user_id = %s", [body.active, user_id])
    if n == 0:
        raise HTTPException(404, "User not found")
    row = fetch_one("SELECT * FROM sg.app_user WHERE user_id = %s", [user_id])
    return _to_public(row)


@router.post("/users/{user_id}/reset-password")
def reset_user_password(user_id: int, _: dict = Depends(require_super_admin)):
    user = fetch_one("SELECT user_id FROM sg.app_user WHERE user_id = %s", [user_id])
    if not user:
        raise HTTPException(404, "User not found")
    temp_password = secrets.token_urlsafe(6)
    password_hash = auth_utils.hash_password(temp_password)
    execute(
        "UPDATE sg.app_user SET password_hash = %s, reset_token_hash = NULL, "
        "reset_token_expires_at = NULL WHERE user_id = %s",
        [password_hash, user_id],
    )
    return {"temp_password": temp_password}
