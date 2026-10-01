"""Request/response shapes for the API."""
from __future__ import annotations

from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field


class SnapshotOut(BaseModel):
    snapshot_id: int
    snapshot_date: date
    snapshot_type: str
    source_file: str | None = None
    row_count: int


class RunRequest(BaseModel):
    snapshot_id: int | None = Field(None, description="Defaults to the newest snapshot")
    only: list[str] | None = Field(None, description="Limit to these rule codes")


class RuleParamsIn(BaseModel):
    params: dict[str, Any] | None = None
    is_enabled: bool | None = None
    severity: Literal["low", "medium", "high"] | None = None


class GlobalConfigIn(BaseModel):
    params: dict[str, Any]


class ExceptionIn(BaseModel):
    rule_code: str
    customer_code: str | None = None
    salesman_key: int | None = None
    note: str | None = None


class NoteIn(BaseModel):
    author: str
    note: str


class LoginIn(BaseModel):
    email: str
    password: str
    role: Literal["superadmin", "manager", "salesperson"]


class UserOut(BaseModel):
    id: int
    name: str | None = None
    email: str | None = None
    role: str


class LoginOut(BaseModel):
    token: str
    user: UserOut


class ForgotPasswordIn(BaseModel):
    email: str


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str


class MessageOut(BaseModel):
    message: str


class CollectionIn(BaseModel):
    customer_code: str
    document_ids: list[int]
    amount: float
    payment_mode: Literal["cash", "upi", "cheque"]


class ViolationNoteIn(BaseModel):
    note: str


class AdminUserIn(BaseModel):
    name: str
    email: str
    role: Literal["superadmin", "manager", "salesperson"]
    employee_id: str | None = None
    phone: str | None = None


class AdminUserUpdateIn(BaseModel):
    name: str | None = None
    email: str | None = None
    role: Literal["superadmin", "manager", "salesperson"] | None = None
    employee_id: str | None = None
    phone: str | None = None


class SetActiveIn(BaseModel):
    active: bool
