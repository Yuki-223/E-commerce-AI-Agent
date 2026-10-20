from __future__ import annotations

"""Persisted orders with stock reservation and a small status machine.

Checkout splits lines by merchant, so one checkout can produce several orders that
share a ``checkout_id``. Stock is deducted inside the same ``BEGIN IMMEDIATE``
transaction that writes the orders, with a conditional ``UPDATE`` so two buyers can
never take the last unit twice. Cancelling, refunding, or letting an unpaid order
expire puts the stock back.

Status flow::

    pending_payment ──pay──▶ paid ──ship──▶ shipped ──confirm──▶ completed
          │                   │                │
          └─cancel/expire─▶ cancelled          │
                              └──request_refund┴─▶ refund_requested ─approve─▶ refunded
                                                          └──reject──▶ (previous status)

Payment is simulated: ``pay`` just records the transition.
"""

import json
import os
import sqlite3
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

from store.commerce_schema import ensure_commerce_schema
from store.product_store import DEFAULT_DB_PATH, load_json_text


STATUS_LABELS = {
    "pending_payment": "待支付",
    "paid": "待发货",
    "shipped": "已发货",
    "completed": "已完成",
    "cancelled": "已取消",
    "refund_requested": "退款中",
    "refunded": "已退款",
}

# Unpaid orders are cancelled after this many minutes and their stock released.
PAY_TIMEOUT_MINUTES = int(os.getenv("ORDER_PAY_TIMEOUT_MINUTES", "30"))

ADMIN_SCOPE = "*"


class OrderError(Exception):
    """An order operation that is not allowed in the order's current state."""


class OrderNotFoundError(OrderError):
    """The order does not exist or is not visible to the caller."""


class OutOfStockError(OrderError):
    """A line asks for more units than the SKU has left."""


@dataclass(frozen=True)
class LineInput:
    product_id: str
    sku_id: str | None
    quantity: int


@dataclass(frozen=True)
class OrderItem:
    product_id: str
    sku_id: str
    title: str
    options: dict[str, Any]
    quantity: int
    unit_price: float

    @property
    def subtotal(self) -> float:
        return round(self.unit_price * self.quantity, 2)

    def to_dict(self) -> dict[str, Any]:
        return {
            "product_id": self.product_id,
            "sku_id": self.sku_id,
            "title": self.title,
            "options": self.options,
            "quantity": self.quantity,
            "unit_price": self.unit_price,
            "subtotal": self.subtotal,
        }


@dataclass(frozen=True)
class Order:
    order_id: str
    checkout_id: str
    user_id: str
    merchant_id: str | None
    merchant_name: str
    status: str
    total: float
    address: str
    created_at: str
    items: list[OrderItem] = field(default_factory=list)
    carrier: str | None = None
    tracking_no: str | None = None
    refund_reason: str | None = None
    paid_at: str | None = None
    shipped_at: str | None = None
    completed_at: str | None = None
    cancelled_at: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "order_id": self.order_id,
            "checkout_id": self.checkout_id,
            "user_id": self.user_id,
            "merchant_id": self.merchant_id,
            "merchant_name": self.merchant_name,
            "status": self.status,
            "status_label": STATUS_LABELS.get(self.status, self.status),
            "total": self.total,
            "item_count": sum(item.quantity for item in self.items),
            "address": self.address,
            "items": [item.to_dict() for item in self.items],
            "carrier": self.carrier,
            "tracking_no": self.tracking_no,
            "refund_reason": self.refund_reason,
            "created_at": self.created_at,
            "paid_at": self.paid_at,
            "shipped_at": self.shipped_at,
            "completed_at": self.completed_at,
            "cancelled_at": self.cancelled_at,
        }


class OrderStore:
    def __init__(self, db_path: Path = DEFAULT_DB_PATH) -> None:
        self.db_path = db_path
        with self._connect() as conn:
            ensure_commerce_schema(conn)

    # ------------------------------ Checkout ------------------------------

    def create_orders(self, user_id: str, lines: Iterable[LineInput], address: str) -> list[Order]:
        """Reserve stock and write one order per merchant, all or nothing."""
        wanted = [line for line in lines if line.quantity > 0]
        if not wanted:
            raise OrderError("没有可下单的商品")
        checkout_id = "co_" + uuid.uuid4().hex[:12]
        by_merchant: dict[str | None, list[OrderItem]] = defaultdict(list)

        with self._connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            try:
                for line in wanted:
                    sku = self._resolve_sku(conn, line.product_id, line.sku_id)
                    if sku is None:
                        raise OrderNotFoundError(f"商品 {line.product_id} 没有可购买的 SKU")
                    cur = conn.execute(
                        "UPDATE product_skus SET stock_qty = stock_qty - ? "
                        "WHERE sku_id = ? AND stock_qty >= ?",
                        (line.quantity, sku["sku_id"], line.quantity),
                    )
                    if cur.rowcount == 0:
                        raise OutOfStockError(
                            f"「{sku['title']}」库存不足（剩余 {int(sku['stock_qty'])} 件）"
                        )
                    by_merchant[sku["merchant_id"]].append(
                        OrderItem(
                            product_id=line.product_id,
                            sku_id=sku["sku_id"],
                            title=sku["title"],
                            options=load_json_text(sku["properties_json"]),
                            quantity=line.quantity,
                            unit_price=float(sku["price"]),
                        )
                    )

                order_ids: list[str] = []
                for merchant_id, items in by_merchant.items():
                    order_id = "ord_" + uuid.uuid4().hex[:12]
                    total = round(sum(item.subtotal for item in items), 2)
                    conn.execute(
                        "INSERT INTO orders(order_id, checkout_id, user_id, merchant_id, status, total, address) "
                        "VALUES (?, ?, ?, ?, 'pending_payment', ?, ?)",
                        (order_id, checkout_id, user_id, merchant_id, total, address),
                    )
                    conn.executemany(
                        "INSERT INTO order_items(order_id, product_id, sku_id, title, options_json, quantity, unit_price) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?)",
                        [
                            (order_id, i.product_id, i.sku_id, i.title, _json(i.options), i.quantity, i.unit_price)
                            for i in items
                        ],
                    )
                    order_ids.append(order_id)
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            return [self._load(conn, order_id) for order_id in order_ids]

    # ------------------------------ Read ------------------------------

    def get(self, order_id: str, *, user_id: str | None = None, merchant_id: str | None = None) -> Order:
        """Return one order visible to the buyer (``user_id``) or seller (``merchant_id``)."""
        self.expire_unpaid()
        with self._connect() as conn:
            row = conn.execute("SELECT user_id, merchant_id FROM orders WHERE order_id = ?", (order_id,)).fetchone()
            if row is None or not _visible(row, user_id, merchant_id):
                raise OrderNotFoundError("订单不存在")
            return self._load(conn, order_id)

    def list_for_user(self, user_id: str, status: str | None = None) -> list[Order]:
        return self._list("user_id = ?", [user_id], status)

    def list_for_merchant(self, merchant_id: str, status: str | None = None) -> list[Order]:
        if merchant_id == ADMIN_SCOPE:
            return self._list("1 = 1", [], status)
        return self._list("merchant_id = ?", [merchant_id], status)

    # ------------------------------ Buyer actions ------------------------------

    def pay(self, order_id: str, user_id: str) -> Order:
        return self._transition(order_id, {"pending_payment"}, "paid", user_id=user_id, stamp="paid_at")

    def cancel(self, order_id: str, user_id: str) -> Order:
        return self._transition(
            order_id, {"pending_payment"}, "cancelled", user_id=user_id, stamp="cancelled_at", restock=True
        )

    def confirm_receipt(self, order_id: str, user_id: str) -> Order:
        return self._transition(order_id, {"shipped"}, "completed", user_id=user_id, stamp="completed_at")

    def request_refund(self, order_id: str, user_id: str, reason: str) -> Order:
        return self._transition(
            order_id,
            {"paid", "shipped"},
            "refund_requested",
            user_id=user_id,
            extra={"refund_reason": reason.strip() or "未填写原因"},
            remember_prev=True,
        )

    # ------------------------------ Seller actions ------------------------------

    def ship(self, order_id: str, merchant_id: str, carrier: str, tracking_no: str) -> Order:
        if not carrier.strip() or not tracking_no.strip():
            raise OrderError("请填写物流公司和运单号")
        return self._transition(
            order_id,
            {"paid"},
            "shipped",
            merchant_id=merchant_id,
            stamp="shipped_at",
            extra={"carrier": carrier.strip(), "tracking_no": tracking_no.strip()},
        )

    def approve_refund(self, order_id: str, merchant_id: str) -> Order:
        return self._transition(
            order_id, {"refund_requested"}, "refunded", merchant_id=merchant_id, stamp="cancelled_at", restock=True
        )

    def reject_refund(self, order_id: str, merchant_id: str) -> Order:
        return self._transition(order_id, {"refund_requested"}, None, merchant_id=merchant_id)

    # ------------------------------ Maintenance ------------------------------

    def expire_unpaid(self, timeout_minutes: int = PAY_TIMEOUT_MINUTES) -> int:
        """Cancel unpaid orders past the payment window and release their stock."""
        with self._connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            rows = conn.execute(
                "SELECT order_id FROM orders WHERE status = 'pending_payment' "
                "AND created_at <= datetime('now', ?)",
                (f"-{int(timeout_minutes)} minutes",),
            ).fetchall()
            for row in rows:
                self._restock(conn, row["order_id"])
                conn.execute(
                    "UPDATE orders SET status = 'cancelled', cancelled_at = datetime('now'), "
                    "updated_at = datetime('now') WHERE order_id = ?",
                    (row["order_id"],),
                )
            conn.commit()
        return len(rows)

    def merchant_stats(self, merchant_id: str) -> dict[str, Any]:
        """Dashboard numbers: status counts, revenue, top sellers, and 7-day sales."""
        self.expire_unpaid()
        scope, params = ("1 = 1", []) if merchant_id == ADMIN_SCOPE else ("o.merchant_id = ?", [merchant_id])
        sold = "o.status IN ('paid', 'shipped', 'completed', 'refund_requested')"
        with self._connect() as conn:
            counts = {
                row["status"]: int(row["n"])
                for row in conn.execute(
                    f"SELECT status, COUNT(*) AS n FROM orders o WHERE {scope} GROUP BY status", params
                ).fetchall()
            }
            revenue = conn.execute(
                f"SELECT COALESCE(SUM(total), 0) AS s, COUNT(*) AS n FROM orders o WHERE {scope} AND {sold}",
                params,
            ).fetchone()
            top = conn.execute(
                f"""
                SELECT i.product_id, MAX(i.title) AS title, SUM(i.quantity) AS quantity,
                       ROUND(SUM(i.quantity * i.unit_price), 2) AS sales
                FROM order_items i JOIN orders o ON o.order_id = i.order_id
                WHERE {scope} AND {sold}
                GROUP BY i.product_id ORDER BY quantity DESC, sales DESC LIMIT 5
                """,
                params,
            ).fetchall()
            daily = conn.execute(
                f"""
                SELECT date(o.created_at) AS day, ROUND(SUM(o.total), 2) AS sales, COUNT(*) AS orders
                FROM orders o
                WHERE {scope} AND {sold} AND o.created_at >= datetime('now', '-6 days', 'start of day')
                GROUP BY day ORDER BY day
                """,
                params,
            ).fetchall()
        return {
            "status_counts": {status: counts.get(status, 0) for status in STATUS_LABELS},
            "order_count": sum(counts.values()),
            "paid_order_count": int(revenue["n"]),
            "revenue": round(float(revenue["s"]), 2),
            "top_products": [dict(row) for row in top],
            "daily_sales": [dict(row) for row in daily],
        }

    # ------------------------------ Internal ------------------------------

    def _list(self, where: str, params: list[Any], status: str | None) -> list[Order]:
        self.expire_unpaid()
        if status:
            where += " AND status = ?"
            params = [*params, status]
        with self._connect() as conn:
            ids = [
                row["order_id"]
                for row in conn.execute(
                    f"SELECT order_id FROM orders WHERE {where} ORDER BY created_at DESC, rowid DESC",
                    params,
                ).fetchall()
            ]
            return [self._load(conn, order_id) for order_id in ids]

    def _transition(
        self,
        order_id: str,
        allowed_from: set[str],
        to_status: str | None,
        *,
        user_id: str | None = None,
        merchant_id: str | None = None,
        stamp: str | None = None,
        extra: dict[str, Any] | None = None,
        restock: bool = False,
        remember_prev: bool = False,
    ) -> Order:
        """Move an order between states; ``to_status=None`` restores ``prev_status``."""
        self.expire_unpaid()
        with self._connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            try:
                row = conn.execute(
                    "SELECT user_id, merchant_id, status, prev_status FROM orders WHERE order_id = ?",
                    (order_id,),
                ).fetchone()
                if row is None or not _visible(row, user_id, merchant_id):
                    raise OrderNotFoundError("订单不存在")
                if row["status"] not in allowed_from:
                    raise OrderError(f"订单当前状态为「{STATUS_LABELS.get(row['status'], row['status'])}」，不能执行该操作")
                target = to_status or row["prev_status"] or "paid"
                updates: dict[str, Any] = {"status": target, **(extra or {})}
                updates["prev_status"] = row["status"] if remember_prev else None
                assignments = ", ".join(f"{key} = ?" for key in updates)
                if stamp:
                    assignments += f", {stamp} = datetime('now')"
                conn.execute(
                    f"UPDATE orders SET {assignments}, updated_at = datetime('now') WHERE order_id = ?",
                    (*updates.values(), order_id),
                )
                if restock:
                    self._restock(conn, order_id)
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            return self._load(conn, order_id)

    def _restock(self, conn: sqlite3.Connection, order_id: str) -> None:
        conn.execute(
            """
            UPDATE product_skus SET stock_qty = stock_qty + (
                SELECT SUM(i.quantity) FROM order_items i
                WHERE i.order_id = ? AND i.sku_id = product_skus.sku_id
            )
            WHERE sku_id IN (SELECT sku_id FROM order_items WHERE order_id = ?)
            """,
            (order_id, order_id),
        )

    def _resolve_sku(self, conn: sqlite3.Connection, product_id: str, sku_id: str | None) -> sqlite3.Row | None:
        base = (
            "SELECT s.sku_id, s.properties_json, s.price, s.stock_qty, p.title, p.merchant_id "
            "FROM product_skus s JOIN products p ON p.product_id = s.product_id "
            "WHERE s.product_id = ? AND s.status = 'active' AND p.status = 'active'"
        )
        if sku_id:
            return conn.execute(base + " AND s.sku_id = ?", (product_id, sku_id)).fetchone()
        # Default to the cheapest SKU, matching CartStore.add_product.
        return conn.execute(base + " ORDER BY s.price ASC, s.sku_id ASC LIMIT 1", (product_id,)).fetchone()

    def _load(self, conn: sqlite3.Connection, order_id: str) -> Order:
        row = conn.execute(
            "SELECT o.*, COALESCE(m.name, 'CartPilot 自营') AS merchant_name "
            "FROM orders o LEFT JOIN merchants m ON m.merchant_id = o.merchant_id WHERE o.order_id = ?",
            (order_id,),
        ).fetchone()
        if row is None:
            raise OrderNotFoundError("订单不存在")
        items = [
            OrderItem(
                product_id=item["product_id"],
                sku_id=item["sku_id"],
                title=item["title"],
                options=load_json_text(item["options_json"]),
                quantity=int(item["quantity"]),
                unit_price=float(item["unit_price"]),
            )
            for item in conn.execute(
                "SELECT * FROM order_items WHERE order_id = ? ORDER BY order_item_id", (order_id,)
            ).fetchall()
        ]
        return Order(
            order_id=row["order_id"],
            checkout_id=row["checkout_id"],
            user_id=row["user_id"],
            merchant_id=row["merchant_id"],
            merchant_name=row["merchant_name"],
            status=row["status"],
            total=float(row["total"]),
            address=row["address"],
            created_at=row["created_at"],
            items=items,
            carrier=row["carrier"],
            tracking_no=row["tracking_no"],
            refund_reason=row["refund_reason"],
            paid_at=row["paid_at"],
            shipped_at=row["shipped_at"],
            completed_at=row["completed_at"],
            cancelled_at=row["cancelled_at"],
        )

    def _connect(self) -> sqlite3.Connection:
        if not self.db_path.exists():
            raise FileNotFoundError(f"SQLite 商品库不存在：{self.db_path}")
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout = 5000")
        return conn


def _visible(row: sqlite3.Row, user_id: str | None, merchant_id: str | None) -> bool:
    if user_id is not None:
        return row["user_id"] == user_id
    if merchant_id is not None:
        return merchant_id == ADMIN_SCOPE or row["merchant_id"] == merchant_id
    return False


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
