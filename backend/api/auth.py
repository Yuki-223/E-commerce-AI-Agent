from __future__ import annotations

"""Login, registration, and request identity.

Tokens are stateless HMAC-SHA256-signed JSON (``<payload b64>.<signature b64>``) so the
demo needs no extra dependency or token table. Set ``AUTH_SECRET`` in production; the
built-in development secret makes every token forgeable by anyone who reads this file.

Requests without ``Authorization: Bearer <token>`` act as the demo shopper so the iOS
client and older web builds keep working. Set ``AUTH_REQUIRED=1`` to reject them on
cart and order endpoints instead.
"""

import base64
import hashlib
import hmac
import json
import logging
import os
import time
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from store.account_store import Account, AccountError, AccountStore
from store.cart_store import DEMO_USER_ID
from store.order_store import ADMIN_SCOPE


logger = logging.getLogger(__name__)

_DEV_SECRET = "cartpilot-dev-secret-change-me"
TOKEN_TTL_SECONDS = int(os.getenv("AUTH_TOKEN_TTL_SECONDS", str(7 * 24 * 3600)))

router = APIRouter()


def _secret() -> bytes:
    secret = os.getenv("AUTH_SECRET", "").strip()
    if not secret:
        secret = _DEV_SECRET
    return secret.encode("utf-8")


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def issue_token(account: Account, *, now: float | None = None) -> str:
    issued = int(now if now is not None else time.time())
    payload = _b64(json.dumps({"sub": account.user_id, "exp": issued + TOKEN_TTL_SECONDS}).encode())
    signature = _b64(hmac.new(_secret(), payload.encode("ascii"), hashlib.sha256).digest())
    return f"{payload}.{signature}"


def verify_token(token: str, *, now: float | None = None) -> str | None:
    """Return the token's user_id, or ``None`` when forged, malformed, or expired."""
    try:
        payload, signature = token.split(".")
        expected = _b64(hmac.new(_secret(), payload.encode("ascii"), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            return None
        claims = json.loads(_unb64(payload))
    except (ValueError, json.JSONDecodeError):
        return None
    if int(claims.get("exp", 0)) < (now if now is not None else time.time()):
        return None
    sub = claims.get("sub")
    return sub if isinstance(sub, str) else None


def _auth_required() -> bool:
    return os.getenv("AUTH_REQUIRED", "0").strip().lower() in {"1", "true", "yes", "on"}


def accounts() -> AccountStore:
    return AccountStore()


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------

def optional_account(authorization: str | None = Header(None)) -> Account | None:
    """The logged-in account, ``None`` for anonymous requests; a bad token is a 401."""
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Authorization 头格式应为 Bearer <token>")
    user_id = verify_token(token.strip())
    account = accounts().get(user_id) if user_id else None
    if account is None:
        raise HTTPException(status_code=401, detail="登录已失效，请重新登录")
    return account


def require_account(account: Account | None = Depends(optional_account)) -> Account:
    if account is None:
        raise HTTPException(status_code=401, detail="请先登录")
    return account


def shopper_id(account: Account | None = Depends(optional_account)) -> str:
    """Owner of the cart and orders for this request."""
    if account is not None:
        return account.user_id
    if _auth_required():
        raise HTTPException(status_code=401, detail="请先登录")
    return DEMO_USER_ID


def merchant_scope(account: Account = Depends(require_account)) -> str:
    """The merchant_id this request may manage; admins may manage every shop."""
    if account.role == "admin":
        return ADMIN_SCOPE
    if account.role != "merchant" or not account.merchant_id:
        raise HTTPException(status_code=403, detail="仅商家账号可以访问商家后台")
    return account.merchant_id


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    username: str
    password: str
    nickname: str | None = None
    role: str = Field("customer", description="customer 或 merchant")
    shop_name: str | None = Field(None, description="商家注册时必填")


class LoginRequest(BaseModel):
    username: str
    password: str


def _session_payload(account: Account) -> dict[str, Any]:
    return {"token": issue_token(account), "account": account.to_dict()}


@router.post("/auth/register")
def register(req: RegisterRequest) -> dict[str, Any]:
    try:
        account = accounts().register(
            req.username, req.password, nickname=req.nickname, role=req.role, shop_name=req.shop_name
        )
    except AccountError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _session_payload(account)


@router.post("/auth/login")
def login(req: LoginRequest) -> dict[str, Any]:
    account = accounts().authenticate(req.username, req.password)
    if account is None:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    return _session_payload(account)


@router.get("/auth/me")
def me(account: Account = Depends(require_account)) -> dict[str, Any]:
    payload: dict[str, Any] = {"account": account.to_dict(), "merchant": None}
    if account.merchant_id:
        merchant = accounts().get_merchant(account.merchant_id)
        payload["merchant"] = merchant.to_dict() if merchant else None
    return payload


if not os.getenv("AUTH_SECRET", "").strip():
    logger.warning("AUTH_SECRET is not set; using the development secret. Do not deploy like this.")
