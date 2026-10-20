from __future__ import annotations

"""Shipping address book. Each user has at most one default address."""

import sqlite3
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from store.commerce_schema import ensure_commerce_schema
from store.product_store import DEFAULT_DB_PATH


@dataclass(frozen=True)
class Address:
    address_id: int
    user_id: str
    recipient: str
    phone: str
    region: str
    detail: str
    is_default: bool

    def one_line(self) -> str:
        """Text snapshot stored on an order."""
        place = f"{self.region} {self.detail}".strip()
        return f"{place} · 收货人：{self.recipient} · {self.phone}"

    def to_dict(self) -> dict[str, Any]:
        return {**asdict(self), "text": self.one_line()}


class AddressStore:
    def __init__(self, db_path: Path = DEFAULT_DB_PATH) -> None:
        self.db_path = db_path
        with self._connect() as conn:
            ensure_commerce_schema(conn)

    def list(self, user_id: str) -> list[Address]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM user_addresses WHERE user_id = ? "
                "ORDER BY is_default DESC, address_id ASC",
                (user_id,),
            ).fetchall()
        return [self._from_row(row) for row in rows]

    def get(self, user_id: str, address_id: int) -> Address | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM user_addresses WHERE user_id = ? AND address_id = ?",
                (user_id, address_id),
            ).fetchone()
        return self._from_row(row) if row else None

    def default(self, user_id: str) -> Address | None:
        addresses = self.list(user_id)
        return addresses[0] if addresses else None

    def create(
        self,
        user_id: str,
        *,
        recipient: str,
        phone: str,
        detail: str,
        region: str = "",
        is_default: bool = False,
    ) -> Address:
        with self._connect() as conn:
            # The first address becomes the default automatically.
            has_any = conn.execute(
                "SELECT 1 FROM user_addresses WHERE user_id = ?", (user_id,)
            ).fetchone()
            make_default = is_default or not has_any
            if make_default:
                conn.execute("UPDATE user_addresses SET is_default = 0 WHERE user_id = ?", (user_id,))
            cur = conn.execute(
                "INSERT INTO user_addresses(user_id, recipient, phone, region, detail, is_default) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (user_id, recipient.strip(), phone.strip(), region.strip(), detail.strip(), int(make_default)),
            )
            conn.commit()
            address_id = int(cur.lastrowid)
        address = self.get(user_id, address_id)
        assert address is not None
        return address

    def update(self, user_id: str, address_id: int, **fields: Any) -> Address | None:
        allowed = {k: v for k, v in fields.items() if k in {"recipient", "phone", "region", "detail"} and v is not None}
        with self._connect() as conn:
            if not conn.execute(
                "SELECT 1 FROM user_addresses WHERE user_id = ? AND address_id = ?",
                (user_id, address_id),
            ).fetchone():
                return None
            if allowed:
                assignments = ", ".join(f"{key} = ?" for key in allowed)
                conn.execute(
                    f"UPDATE user_addresses SET {assignments} WHERE address_id = ?",
                    (*[str(v).strip() for v in allowed.values()], address_id),
                )
            if fields.get("is_default"):
                conn.execute("UPDATE user_addresses SET is_default = 0 WHERE user_id = ?", (user_id,))
                conn.execute("UPDATE user_addresses SET is_default = 1 WHERE address_id = ?", (address_id,))
            conn.commit()
        return self.get(user_id, address_id)

    def delete(self, user_id: str, address_id: int) -> bool:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT is_default FROM user_addresses WHERE user_id = ? AND address_id = ?",
                (user_id, address_id),
            ).fetchone()
            if row is None:
                return False
            conn.execute("DELETE FROM user_addresses WHERE address_id = ?", (address_id,))
            if row["is_default"]:
                # Promote the oldest remaining address so a default always exists.
                conn.execute(
                    "UPDATE user_addresses SET is_default = 1 WHERE address_id = ("
                    "SELECT MIN(address_id) FROM user_addresses WHERE user_id = ?)",
                    (user_id,),
                )
            conn.commit()
        return True

    def _from_row(self, row: sqlite3.Row) -> Address:
        return Address(
            address_id=int(row["address_id"]),
            user_id=row["user_id"],
            recipient=row["recipient"],
            phone=row["phone"],
            region=row["region"],
            detail=row["detail"],
            is_default=bool(row["is_default"]),
        )

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout = 5000")
        return conn
