from __future__ import annotations

"""Merchant-side catalog management: products, SKUs, prices, and stock.

Every write checks ownership through ``products.merchant_id``. ``ADMIN_SCOPE`` lets the
platform operator manage any product, including the platform-operated catalog whose
``merchant_id`` is NULL.

Unlike ``ProductStore`` (shopper-facing, active products only), this store also returns
inactive products and SKUs so a merchant can relist them.
"""

import json
import sqlite3
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from store.commerce_schema import ensure_commerce_schema
from store.order_store import ADMIN_SCOPE
from store.product_store import DEFAULT_DB_PATH, load_json_text


class CatalogError(Exception):
    """Invalid product input."""


class ProductNotOwnedError(CatalogError):
    """The product does not exist or belongs to another merchant."""


@dataclass(frozen=True)
class SkuInput:
    properties: dict[str, str]
    price: float
    stock_qty: int
    sku_id: str | None = None
    status: str = "active"


class MerchantStore:
    def __init__(self, db_path: Path = DEFAULT_DB_PATH) -> None:
        self.db_path = db_path
        with self._connect() as conn:
            ensure_commerce_schema(conn)

    # ------------------------------ Read ------------------------------

    def list_products(self, merchant_id: str, status: str | None = None) -> list[dict[str, Any]]:
        where, params = self._scope(merchant_id)
        if status:
            where += " AND p.status = ?"
            params.append(status)
        with self._connect() as conn:
            ids = [
                row["product_id"]
                for row in conn.execute(
                    f"SELECT p.product_id FROM products p WHERE {where} "
                    "ORDER BY p.updated_at DESC, p.product_id",
                    params,
                ).fetchall()
            ]
            return [self._load(conn, product_id) for product_id in ids]

    def get_product(self, merchant_id: str, product_id: str) -> dict[str, Any]:
        with self._connect() as conn:
            self._check_owner(conn, merchant_id, product_id)
            return self._load(conn, product_id)

    # ------------------------------ Write ------------------------------

    def create_product(
        self,
        merchant_id: str,
        *,
        title: str,
        brand: str,
        category: str,
        sub_category: str = "",
        image_url: str,
        description: str = "",
        skus: list[SkuInput],
    ) -> dict[str, Any]:
        if merchant_id == ADMIN_SCOPE:
            raise CatalogError("平台账号请用商家账号发布商品")
        _require(title=title, brand=brand, category=category, image_url=image_url)
        if not skus:
            raise CatalogError("至少需要一个 SKU")
        _validate_skus(skus)

        product_id = "p_m_" + uuid.uuid4().hex[:10]
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO products(product_id, title, brand, category, sub_category, base_price, "
                "image_url, status, merchant_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)",
                (
                    product_id, title.strip(), brand.strip(), category.strip(), sub_category.strip(),
                    min(s.price for s in skus), image_url.strip(), merchant_id,
                ),
            )
            conn.execute(
                "INSERT INTO product_descriptions(product_id, marketing_description) VALUES (?, ?)",
                (product_id, description.strip()),
            )
            for index, sku in enumerate(skus, start=1):
                self._insert_sku(conn, product_id, sku, f"{product_id}_s{index}")
            conn.commit()
            return self._load(conn, product_id)

    def update_product(self, merchant_id: str, product_id: str, **fields: Any) -> dict[str, Any]:
        """Patch product fields; ``description`` updates the marketing copy."""
        columns = {
            key: str(value).strip()
            for key, value in fields.items()
            if key in {"title", "brand", "category", "sub_category", "image_url"} and value is not None
        }
        for key in ("title", "brand", "category", "image_url"):
            if key in columns and not columns[key]:
                raise CatalogError(f"{key} 不能为空")
        with self._connect() as conn:
            self._check_owner(conn, merchant_id, product_id)
            if columns:
                assignments = ", ".join(f"{key} = ?" for key in columns)
                conn.execute(
                    f"UPDATE products SET {assignments} WHERE product_id = ?",
                    (*columns.values(), product_id),
                )
            if fields.get("description") is not None:
                conn.execute(
                    "INSERT INTO product_descriptions(product_id, marketing_description) VALUES (?, ?) "
                    "ON CONFLICT(product_id) DO UPDATE SET marketing_description = excluded.marketing_description",
                    (product_id, str(fields["description"]).strip()),
                )
            conn.commit()
            return self._load(conn, product_id)

    def set_status(self, merchant_id: str, product_id: str, status: str) -> dict[str, Any]:
        """List (``active``) or delist (``inactive``) a product."""
        if status not in ("active", "inactive"):
            raise CatalogError("status 只能是 active 或 inactive")
        with self._connect() as conn:
            self._check_owner(conn, merchant_id, product_id)
            if status == "active" and not conn.execute(
                "SELECT 1 FROM product_skus WHERE product_id = ? AND status = 'active'", (product_id,)
            ).fetchone():
                raise CatalogError("没有在售 SKU 的商品不能上架")
            conn.execute("UPDATE products SET status = ? WHERE product_id = ?", (status, product_id))
            conn.commit()
            return self._load(conn, product_id)

    def upsert_sku(self, merchant_id: str, product_id: str, sku: SkuInput) -> dict[str, Any]:
        """Update an existing SKU (``sku.sku_id`` set) or add a new one."""
        _validate_skus([sku])
        with self._connect() as conn:
            self._check_owner(conn, merchant_id, product_id)
            if sku.sku_id:
                cur = conn.execute(
                    "UPDATE product_skus SET properties_json = ?, price = ?, stock_qty = ?, status = ? "
                    "WHERE sku_id = ? AND product_id = ?",
                    (_json(sku.properties), sku.price, sku.stock_qty, sku.status, sku.sku_id, product_id),
                )
                if cur.rowcount == 0:
                    raise CatalogError("SKU 不存在")
            else:
                count = conn.execute(
                    "SELECT COUNT(*) FROM product_skus WHERE product_id = ?", (product_id,)
                ).fetchone()[0]
                self._insert_sku(conn, product_id, sku, f"{product_id}_s{count + 1}_{uuid.uuid4().hex[:4]}")
            self._refresh_base_price(conn, product_id)
            conn.commit()
            return self._load(conn, product_id)

    # ------------------------------ Internal ------------------------------

    def _scope(self, merchant_id: str) -> tuple[str, list[Any]]:
        if merchant_id == ADMIN_SCOPE:
            return "1 = 1", []
        return "p.merchant_id = ?", [merchant_id]

    def _check_owner(self, conn: sqlite3.Connection, merchant_id: str, product_id: str) -> None:
        row = conn.execute("SELECT merchant_id FROM products WHERE product_id = ?", (product_id,)).fetchone()
        if row is None or (merchant_id != ADMIN_SCOPE and row["merchant_id"] != merchant_id):
            raise ProductNotOwnedError("商品不存在或不属于你的店铺")

    def _insert_sku(self, conn: sqlite3.Connection, product_id: str, sku: SkuInput, sku_id: str) -> None:
        conn.execute(
            "INSERT INTO product_skus(sku_id, product_id, properties_json, price, stock_qty, status) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (sku_id, product_id, _json(sku.properties), sku.price, sku.stock_qty, sku.status),
        )

    def _refresh_base_price(self, conn: sqlite3.Connection, product_id: str) -> None:
        conn.execute(
            "UPDATE products SET base_price = COALESCE(("
            "SELECT MIN(price) FROM product_skus WHERE product_id = ? AND status = 'active'"
            "), base_price) WHERE product_id = ?",
            (product_id, product_id),
        )

    def _load(self, conn: sqlite3.Connection, product_id: str) -> dict[str, Any]:
        row = conn.execute(
            """
            SELECT p.product_id, p.title, p.brand, p.category, p.sub_category, p.base_price,
                   p.image_path, p.image_url, p.status, p.merchant_id, p.updated_at,
                   COALESCE(d.marketing_description, '') AS description
            FROM products p LEFT JOIN product_descriptions d ON d.product_id = p.product_id
            WHERE p.product_id = ?
            """,
            (product_id,),
        ).fetchone()
        skus = [
            {
                "sku_id": sku["sku_id"],
                "properties": load_json_text(sku["properties_json"]),
                "price": float(sku["price"]),
                "stock_qty": int(sku["stock_qty"]),
                "status": sku["status"],
            }
            for sku in conn.execute(
                "SELECT * FROM product_skus WHERE product_id = ? ORDER BY price, sku_id", (product_id,)
            ).fetchall()
        ]
        sold = conn.execute(
            "SELECT COALESCE(SUM(i.quantity), 0) FROM order_items i JOIN orders o ON o.order_id = i.order_id "
            "WHERE i.product_id = ? AND o.status IN ('paid', 'shipped', 'completed', 'refund_requested')",
            (product_id,),
        ).fetchone()[0]
        return {
            **dict(row),
            "base_price": float(row["base_price"]),
            "skus": skus,
            "total_stock": sum(s["stock_qty"] for s in skus if s["status"] == "active"),
            "sold_qty": int(sold),
        }

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA busy_timeout = 5000")
        return conn


def _require(**values: str) -> None:
    for key, value in values.items():
        if not (value or "").strip():
            raise CatalogError(f"{key} 不能为空")


def _validate_skus(skus: list[SkuInput]) -> None:
    for sku in skus:
        if sku.price < 0:
            raise CatalogError("价格不能为负")
        if sku.stock_qty < 0:
            raise CatalogError("库存不能为负")
        if sku.status not in ("active", "inactive"):
            raise CatalogError("SKU status 只能是 active 或 inactive")


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
