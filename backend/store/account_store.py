from __future__ import annotations

"""Login accounts, roles, and merchant shops.

A shopper's ``user_id`` is shared with ``users`` (cart and order ownership) and
``accounts`` (credentials and role). A merchant account additionally owns one row in
``merchants``; products point at it through ``products.merchant_id``.

Passwords use PBKDF2-HMAC-SHA256 from the standard library, so no extra dependency is
needed. The stored format is ``pbkdf2_sha256$<iterations>$<salt hex>$<hash hex>``.
"""

import hashlib
import hmac
import re
import secrets
import sqlite3
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from store.commerce_schema import ensure_commerce_schema
from store.product_store import DEFAULT_DB_PATH


ROLES = ("customer", "merchant", "admin")
_PBKDF2_ITERATIONS = 200_000
_USERNAME_RE = re.compile(r"^[A-Za-z0-9_\-.@一-鿿]{3,32}$")


class AccountError(Exception):
    """Raised for invalid registration input or a username clash."""


@dataclass(frozen=True)
class Account:
    user_id: str
    username: str
    nickname: str
    role: str
    merchant_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class Merchant:
    merchant_id: str
    owner_user_id: str
    name: str
    description: str
    status: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def hash_password(password: str, *, iterations: int = _PBKDF2_ITERATIONS) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt_hex, digest_hex = stored.split("$")
    except ValueError:
        return False
    if scheme != "pbkdf2_sha256":
        return False
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iterations)
    )
    return hmac.compare_digest(digest.hex(), digest_hex)


class AccountStore:
    def __init__(self, db_path: Path = DEFAULT_DB_PATH) -> None:
        self.db_path = db_path
        with self._connect() as conn:
            ensure_commerce_schema(conn)

    # ------------------------------ Accounts ------------------------------

    def register(
        self,
        username: str,
        password: str,
        *,
        nickname: str | None = None,
        role: str = "customer",
        shop_name: str | None = None,
    ) -> Account:
        """Create an account; a merchant account also opens its shop."""
        username = (username or "").strip()
        if not _USERNAME_RE.match(username):
            raise AccountError("用户名需为 3-32 位字母、数字、中文或 _-.@")
        if len(password or "") < 6:
            raise AccountError("密码至少 6 位")
        if role not in ("customer", "merchant"):
            raise AccountError("只能注册顾客或商家账号")
        if role == "merchant" and not (shop_name or "").strip():
            raise AccountError("商家注册需要填写店铺名称")

        user_id = "u_" + uuid.uuid4().hex[:12]
        display = (nickname or "").strip() or username
        with self._connect() as conn:
            if conn.execute("SELECT 1 FROM accounts WHERE username = ?", (username,)).fetchone():
                raise AccountError("用户名已被注册")
            conn.execute("INSERT INTO users(user_id, nickname) VALUES (?, ?)", (user_id, display))
            conn.execute(
                "INSERT INTO accounts(user_id, username, password_hash, role) VALUES (?, ?, ?, ?)",
                (user_id, username, hash_password(password), role),
            )
            if role == "merchant":
                conn.execute(
                    "INSERT INTO merchants(merchant_id, owner_user_id, name) VALUES (?, ?, ?)",
                    ("m_" + uuid.uuid4().hex[:12], user_id, shop_name.strip()),  # type: ignore[union-attr]
                )
            conn.commit()
        account = self.get(user_id)
        assert account is not None
        return account

    def authenticate(self, username: str, password: str) -> Account | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT user_id, password_hash FROM accounts WHERE username = ?",
                ((username or "").strip(),),
            ).fetchone()
        if row is None or not verify_password(password or "", row["password_hash"]):
            return None
        return self.get(row["user_id"])

    def get(self, user_id: str) -> Account | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT a.user_id, a.username, a.role, u.nickname, m.merchant_id
                FROM accounts a
                JOIN users u ON u.user_id = a.user_id
                LEFT JOIN merchants m ON m.owner_user_id = a.user_id
                WHERE a.user_id = ?
                """,
                (user_id,),
            ).fetchone()
        if row is None:
            return None
        return Account(
            user_id=row["user_id"],
            username=row["username"],
            nickname=row["nickname"],
            role=row["role"],
            merchant_id=row["merchant_id"],
        )

    # ------------------------------ Merchants ------------------------------

    def get_merchant(self, merchant_id: str) -> Merchant | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT merchant_id, owner_user_id, name, description, status "
                "FROM merchants WHERE merchant_id = ?",
                (merchant_id,),
            ).fetchone()
        return Merchant(**dict(row)) if row else None

    def update_merchant(
        self, merchant_id: str, *, name: str | None = None, description: str | None = None
    ) -> Merchant | None:
        fields: dict[str, str] = {}
        if name is not None and name.strip():
            fields["name"] = name.strip()
        if description is not None:
            fields["description"] = description.strip()
        if fields:
            assignments = ", ".join(f"{key} = ?" for key in fields)
            with self._connect() as conn:
                conn.execute(
                    f"UPDATE merchants SET {assignments} WHERE merchant_id = ?",
                    (*fields.values(), merchant_id),
                )
                conn.commit()
        return self.get_merchant(merchant_id)

    # ------------------------------ Internal ------------------------------

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout = 5000")
        return conn
