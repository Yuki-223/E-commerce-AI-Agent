from __future__ import annotations

"""Schema for accounts, merchants, addresses, and persisted orders.

``db/init.sql`` creates these tables for fresh databases. ``ensure_commerce_schema``
applies the same DDL to databases built before they existed, so a running demo can
upgrade without ``import_product_data --reset``. Every statement is idempotent.
"""

import sqlite3


COMMERCE_DDL = """
CREATE TABLE IF NOT EXISTS accounts (
    user_id       TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'customer'
        CHECK (role IN ('customer', 'merchant', 'admin')),
    created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchants (
    merchant_id   TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('pending', 'active', 'suspended')),
    created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_addresses (
    address_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL,
    recipient  TEXT NOT NULL,
    phone      TEXT NOT NULL,
    region     TEXT NOT NULL DEFAULT '',
    detail     TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- orders: one row per merchant per checkout. merchant_id NULL means platform-operated.
-- prev_status remembers where a refund request came from so a rejection can restore it.
CREATE TABLE IF NOT EXISTS orders (
    order_id      TEXT PRIMARY KEY,
    checkout_id   TEXT NOT NULL,
    user_id       TEXT NOT NULL,
    merchant_id   TEXT,
    status        TEXT NOT NULL DEFAULT 'pending_payment'
        CHECK (status IN ('pending_payment', 'paid', 'shipped', 'completed',
                          'cancelled', 'refund_requested', 'refunded')),
    prev_status   TEXT,
    total         REAL NOT NULL CHECK (total >= 0),
    address       TEXT NOT NULL,
    carrier       TEXT,
    tracking_no   TEXT,
    refund_reason TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    paid_at       TEXT,
    shipped_at    TEXT,
    completed_at  TEXT,
    cancelled_at  TEXT,
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- order_items: title, options and price are snapshots taken at checkout.
CREATE TABLE IF NOT EXISTS order_items (
    order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id      TEXT NOT NULL,
    product_id    TEXT NOT NULL,
    sku_id        TEXT NOT NULL,
    title         TEXT NOT NULL,
    options_json  TEXT NOT NULL DEFAULT '{}',
    quantity      INTEGER NOT NULL CHECK (quantity > 0),
    unit_price    REAL NOT NULL CHECK (unit_price >= 0),
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user ON user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders(merchant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
"""


def table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}


_ensured: set[str] = set()


def ensure_commerce_schema(conn: sqlite3.Connection) -> None:
    """Create commerce tables and add ``products.merchant_id`` / ``attributes_json`` when missing.

    Stores call this on construction, which happens per request, so each database
    file is migrated once per process.
    """
    db_file = conn.execute("PRAGMA database_list").fetchone()[2]
    if db_file and db_file in _ensured:
        return
    conn.executescript(COMMERCE_DDL)
    columns = table_columns(conn, "products")
    if columns and "merchant_id" not in columns:
        conn.execute("ALTER TABLE products ADD COLUMN merchant_id TEXT")
    if columns and "attributes_json" not in columns:
        conn.execute("ALTER TABLE products ADD COLUMN attributes_json TEXT NOT NULL DEFAULT '{}'")
    if columns:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_products_merchant ON products(merchant_id)")
    conn.commit()
    # Only remember a database whose catalog exists, so an early call on an empty
    # file still adds the merchant column once products are imported.
    if db_file and columns:
        _ensured.add(db_file)
