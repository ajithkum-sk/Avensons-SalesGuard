"""Login, forgot-password, reset-password."""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from .. import auth_utils
from ..db import execute, fetch_one
from ..schemas import ForgotPasswordIn, LoginIn, LoginOut, MessageOut, ResetPasswordIn, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

# frontend role names -> db role names (sg.app_user.role check constraint)
FRONTEND_TO_DB_ROLE = {"superadmin": "super_admin", "manager": "manager", "salesperson": "salesman"}
DB_TO_FRONTEND_ROLE = {v: k for k, v in FRONTEND_TO_DB_ROLE.items()}


@router.post("/login", response_model=LoginOut)
def login(body: LoginIn):
    user = fetch_one(
        "SELECT user_id, full_name, email, role, password_hash, is_active "
        "FROM sg.app_user WHERE lower(email) = lower(%s)",
        [body.email],
    )
    if not user or not user["password_hash"] or not auth_utils.verify_password(
        body.password, user["password_hash"]
    ):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user["is_active"]:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user["role"] != FRONTEND_TO_DB_ROLE[body.role]:
        raise HTTPException(status_code=403, detail="Selected role does not match this account")

    token = auth_utils.create_access_token(user)
    return LoginOut(
        token=token,
        user=UserOut(
            id=user["user_id"],
            name=user["full_name"],
            email=user["email"],
            role=DB_TO_FRONTEND_ROLE[user["role"]],
        ),
    )


@router.post("/forgot-password", response_model=MessageOut)
def forgot_password(body: ForgotPasswordIn):
    generic = MessageOut(message="If that account exists, a reset link has been sent.")

    user = fetch_one("SELECT user_id FROM sg.app_user WHERE lower(email) = lower(%s)", [body.email])
    if not user:
        return generic  # same response either way, on purpose

    plain_token, token_hash, expires_at = auth_utils.new_reset_token()
    execute(
        "UPDATE sg.app_user SET reset_token_hash = %s, reset_token_expires_at = %s "
        "WHERE user_id = %s",
        [token_hash, expires_at, user["user_id"]],
    )

    reset_link = f"{__import__('app.config', fromlist=['settings']).settings.app_base_url}/reset-password?token={plain_token}"
    # TODO: wire up real email sending (SMTP / SES / etc). For now, log it so
    # local dev and demos can grab the link.
    print(f"[password-reset] {body.email} -> {reset_link}")

    return generic


@router.post("/reset-password", response_model=MessageOut)
def reset_password(body: ResetPasswordIn):
    token_hash = auth_utils.hash_reset_token(body.token)
    user = fetch_one(
        "SELECT user_id, reset_token_expires_at FROM sg.app_user WHERE reset_token_hash = %s",
        [token_hash],
    )
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    expires_at = user["reset_token_expires_at"]
    if expires_at is None or expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Invalid or expired token")

    new_hash = auth_utils.hash_password(body.new_password)
    execute(
        "UPDATE sg.app_user SET password_hash = %s, reset_token_hash = NULL, "
        "reset_token_expires_at = NULL WHERE user_id = %s",
        [new_hash, user["user_id"]],
    )
    return MessageOut(message="Password updated.")
