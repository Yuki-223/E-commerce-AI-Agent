#!/usr/bin/env python3
"""Account and catalog administration for local demos.

    python -m store.manage create-admin --username admin --password ******
    python -m store.manage assign-products --merchant-user shop1 --brand 她力
    python -m store.manage assign-products --merchant-user shop1 --category 运动服饰

Admin accounts cannot be self-registered over the API; they manage every shop and
the platform-operated catalog (``merchant_id`` NULL). ``assign-products`` hands bundled
products to a merchant so the merchant console has something to manage on day one.
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
import uuid
from pathlib import Path

from store.account_store import AccountStore, hash_password
from store.commerce_schema import ensure_commerce_schema
from store.product_store import DEFAULT_DB_PATH


def create_admin(db: Path, username: str, password: str) -> None:
    AccountStore(db)  # Applies the commerce schema.
    if len(password) < 6:
        sys.exit("密码至少 6 位")
    with sqlite3.connect(db) as conn:
        if conn.execute("SELECT 1 FROM accounts WHERE username = ?", (username,)).fetchone():
            sys.exit(f"用户名 {username} 已存在")
        user_id = "u_" + uuid.uuid4().hex[:12]
        conn.execute("INSERT INTO users(user_id, nickname) VALUES (?, ?)", (user_id, username))
        conn.execute(
            "INSERT INTO accounts(user_id, username, password_hash, role) VALUES (?, ?, ?, 'admin')",
            (user_id, username, hash_password(password)),
        )
    print(f"已创建管理员 {username}（{user_id}）")


def assign_products(db: Path, merchant_user: str, brand: str | None, category: str | None) -> None:
    if not brand and not category:
        sys.exit("请至少指定 --brand 或 --category")
    with sqlite3.connect(db) as conn:
        ensure_commerce_schema(conn)
        row = conn.execute(
            "SELECT m.merchant_id, m.name FROM merchants m JOIN accounts a ON a.user_id = m.owner_user_id "
            "WHERE a.username = ?",
            (merchant_user,),
        ).fetchone()
        if row is None:
            sys.exit(f"找不到商家账号 {merchant_user}")
        clauses, params = ["merchant_id IS NULL"], []
        if brand:
            clauses.append("brand LIKE ?")
            params.append(f"%{brand}%")
        if category:
            clauses.append("(category = ? OR sub_category = ?)")
            params += [category, category]
        cur = conn.execute(
            f"UPDATE products SET merchant_id = ? WHERE {' AND '.join(clauses)}", [row[0], *params]
        )
    print(f"已把 {cur.rowcount} 个平台自营商品分配给店铺「{row[1]}」")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH)
    sub = parser.add_subparsers(dest="command", required=True)

    admin = sub.add_parser("create-admin", help="Create a platform admin account")
    admin.add_argument("--username", required=True)
    admin.add_argument("--password", required=True)

    assign = sub.add_parser("assign-products", help="Give platform-operated products to a merchant")
    assign.add_argument("--merchant-user", required=True, help="The merchant's login username")
    assign.add_argument("--brand")
    assign.add_argument("--category", help="Category or sub-category")

    args = parser.parse_args()
    if args.command == "create-admin":
        create_admin(args.db, args.username, args.password)
    else:
        assign_products(args.db, args.merchant_user, args.brand, args.category)


if __name__ == "__main__":
    main()
