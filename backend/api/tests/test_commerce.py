"""Accounts, persisted orders, stock, addresses, and the merchant console.

Every store the endpoints construct is pointed at a temporary SQLite database built
from ``db/init.sql``, so the suite never touches the real catalog.
"""

from __future__ import annotations

import functools
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from store.account_store import AccountStore, verify_password, hash_password
from store.address_store import AddressStore
from store.cart_store import CartStore
from store.merchant_store import MerchantStore
from store.order_store import OrderStore, OutOfStockError


INIT_SQL = Path(__file__).resolve().parents[2] / "db" / "init.sql"


@pytest.fixture
def db(tmp_path: Path) -> Path:
    path = tmp_path / "shop.sqlite3"
    conn = sqlite3.connect(path)
    conn.executescript(INIT_SQL.read_text(encoding="utf-8"))
    conn.executemany(
        "INSERT INTO products(product_id, title, brand, category, sub_category, base_price, image_url) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            ("p1", "双抗精华", "珀莱雅", "美妆护肤", "精华", 129, "https://img/p1.jpg"),
            ("p2", "降噪耳机", "索尼", "数码电子", "耳机", 999, "https://img/p2.jpg"),
        ],
    )
    conn.executemany(
        "INSERT INTO product_skus(sku_id, product_id, properties_json, price, stock_qty) VALUES (?, ?, ?, ?, ?)",
        [
            ("p1_s1", "p1", '{"容量":"30ml"}', 129, 5),
            ("p1_s2", "p1", '{"容量":"50ml"}', 199, 1),
            ("p2_s1", "p2", '{"颜色":"黑"}', 999, 3),
        ],
    )
    conn.commit()
    conn.close()
    return path


@pytest.fixture
def client(db: Path, monkeypatch):
    from api import auth, main, merchant, orders

    monkeypatch.setattr(main, "CartStore", functools.partial(CartStore, db))
    monkeypatch.setattr(main, "AddressStore", functools.partial(AddressStore, db))
    monkeypatch.setattr(orders, "OrderStore", functools.partial(OrderStore, db))
    monkeypatch.setattr(orders, "AddressStore", functools.partial(AddressStore, db))
    monkeypatch.setattr(merchant, "OrderStore", functools.partial(OrderStore, db))
    monkeypatch.setattr(merchant, "MerchantStore", functools.partial(MerchantStore, db))
    monkeypatch.setattr(auth, "accounts", lambda: AccountStore(db))
    synced: list[str] = []
    monkeypatch.setattr(merchant, "sync_product_safely", synced.append)
    c = TestClient(main.app)
    c.synced = synced  # type: ignore[attr-defined]
    return c


def _register(c: TestClient, username: str, **extra) -> dict:
    r = c.post("/auth/register", json={"username": username, "password": "secret123", **extra})
    assert r.status_code == 200, r.text
    return r.json()


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _stock(db: Path, sku_id: str) -> int:
    with sqlite3.connect(db) as conn:
        return conn.execute("SELECT stock_qty FROM product_skus WHERE sku_id = ?", (sku_id,)).fetchone()[0]


# ------------------------------ Passwords and tokens ------------------------------


def test_password_hash_round_trip():
    stored = hash_password("hunter22", iterations=1000)
    assert verify_password("hunter22", stored)
    assert not verify_password("hunter23", stored)
    assert not verify_password("hunter22", "garbage")


def test_token_rejects_tampering_and_expiry():
    from api.auth import issue_token, verify_token
    from store.account_store import Account

    account = Account("u_1", "alice", "Alice", "customer")
    token = issue_token(account, now=1000)
    assert verify_token(token, now=1001) == "u_1"
    assert verify_token(token, now=1000 + 10**9) is None
    payload, sig = token.split(".")
    assert verify_token(payload + "." + sig[:-2] + "AA", now=1001) is None


# ------------------------------ Auth endpoints ------------------------------


def test_register_login_me(client):
    session = _register(client, "alice", nickname="小爱")
    assert session["account"]["role"] == "customer"
    assert session["account"]["nickname"] == "小爱"

    assert client.post("/auth/register", json={"username": "alice", "password": "secret123"}).status_code == 400
    assert client.post("/auth/login", json={"username": "alice", "password": "wrong"}).status_code == 401

    token = client.post("/auth/login", json={"username": "alice", "password": "secret123"}).json()["token"]
    me = client.get("/auth/me", headers=_auth(token)).json()
    assert me["account"]["username"] == "alice"
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers=_auth("bad.token")).status_code == 401


def test_merchant_registration_requires_shop_name(client):
    r = client.post("/auth/register", json={"username": "shop", "password": "secret123", "role": "merchant"})
    assert r.status_code == 400
    session = _register(client, "shop", role="merchant", shop_name="小店")
    assert session["account"]["merchant_id"].startswith("m_")
    assert client.post(
        "/auth/register", json={"username": "boss", "password": "secret123", "role": "admin"}
    ).status_code == 400


# ------------------------------ Cart isolation and orders ------------------------------


def test_carts_are_isolated_per_account(client):
    alice = _register(client, "alice")["token"]
    bob = _register(client, "bob")["token"]

    client.post("/cart/mutate", json={"action": "add", "productID": "p1"}, headers=_auth(alice))
    assert client.get("/cart", headers=_auth(alice)).json()["cart"]["item_count"] == 1
    assert client.get("/cart", headers=_auth(bob)).json()["cart"]["item_count"] == 0
    assert client.get("/cart").json()["cart"]["item_count"] == 0  # demo shopper


def test_anonymous_cart_rejected_when_auth_required(client, monkeypatch):
    monkeypatch.setenv("AUTH_REQUIRED", "1")
    assert client.get("/cart").status_code == 401


def test_checkout_reserves_stock_and_order_lifecycle(client, db):
    token = _register(client, "alice")["token"]
    h = _auth(token)
    client.post("/addresses", json={"recipient": "小爱", "phone": "13800000000", "detail": "示例路 2 号"}, headers=h)
    cart = client.post("/cart/mutate", json={"action": "add", "productID": "p1", "quantity": 2}, headers=h).json()
    line_id = str(cart["cart"]["lines"][0]["cart_item_id"])

    r = client.post("/orders", json={"cartItemIDs": [line_id]}, headers=h)
    assert r.status_code == 200, r.text
    placed = r.json()["order"]
    assert placed["status"] == "pending_payment"
    assert "小爱" in placed["address"]  # default address-book entry
    assert r.json()["cart"]["item_count"] == 0
    assert _stock(db, "p1_s1") == 3

    orders = client.get("/orders", headers=h).json()["orders"]
    assert [o["order_id"] for o in orders] == [placed["order_id"]]
    assert orders[0]["status_label"] == "待支付"

    oid = placed["order_id"]
    assert client.post(f"/orders/{oid}/confirm", headers=h).status_code == 409  # not shipped yet
    assert client.post(f"/orders/{oid}/pay", headers=h).json()["order"]["status"] == "paid"
    assert client.post(f"/orders/{oid}/cancel", headers=h).status_code == 409  # paid: refund instead

    other = _register(client, "bob")["token"]
    assert client.get(f"/orders/{oid}", headers=_auth(other)).status_code == 404


def test_cancel_releases_stock(client, db):
    h = _auth(_register(client, "alice")["token"])
    oid = client.post("/orders", json={"items": [{"productID": "p2", "quantity": 2}]}, headers=h).json()["order"]["order_id"]
    assert _stock(db, "p2_s1") == 1
    assert client.post(f"/orders/{oid}/cancel", headers=h).json()["order"]["status"] == "cancelled"
    assert _stock(db, "p2_s1") == 3


def test_out_of_stock_is_409_and_keeps_cart(client, db):
    h = _auth(_register(client, "alice")["token"])
    r = client.post("/orders", json={"items": [{"productID": "p1", "skuID": "p1_s2", "quantity": 2}]}, headers=h)
    assert r.status_code == 409
    assert "库存不足" in r.json()["message"]
    assert _stock(db, "p1_s2") == 1


def test_unpaid_orders_expire(db):
    store = OrderStore(db)
    from store.order_store import LineInput

    order = store.create_orders("u_x", [LineInput("p2", None, 1)], "addr")[0]
    with sqlite3.connect(db) as conn:
        conn.execute("UPDATE orders SET created_at = datetime('now', '-2 hours') WHERE order_id = ?", (order.order_id,))
    assert store.get(order.order_id, user_id="u_x").status == "cancelled"
    assert _stock(db, "p2_s1") == 3


def test_concurrent_last_unit_sells_once(db):
    from store.order_store import LineInput

    store = OrderStore(db)
    store.create_orders("u_a", [LineInput("p1", "p1_s2", 1)], "addr")
    with pytest.raises(OutOfStockError):
        store.create_orders("u_b", [LineInput("p1", "p1_s2", 1)], "addr")


# ------------------------------ Merchant console ------------------------------


def test_merchant_publishes_ships_and_refunds(client, db):
    shop = _register(client, "shop", role="merchant", shop_name="小店")
    mh = _auth(shop["token"])
    ch = _auth(_register(client, "alice")["token"])

    assert client.get("/merchant/products", headers=ch).status_code == 403

    r = client.post(
        "/merchant/products",
        json={
            "title": "手冲咖啡豆",
            "brand": "小店",
            "category": "食品生活",
            "sub_category": "咖啡",
            "image_url": "https://img/coffee.jpg",
            "description": "中深烘焙",
            "skus": [{"properties": {"重量": "250g"}, "price": 68, "stock_qty": 10}],
        },
        headers=mh,
    )
    assert r.status_code == 200, r.text
    product = r.json()["product"]
    pid = product["product_id"]
    assert client.synced == [pid]  # type: ignore[attr-defined]

    # A shopper can buy it right away; checkout splits by merchant.
    oid = client.post(
        "/orders", json={"items": [{"productID": pid, "quantity": 2}, {"productID": "p1"}]}, headers=ch
    ).json()["order"]["order_ids"]
    assert len(oid) == 2
    mine = client.get("/merchant/orders", headers=mh).json()["orders"]
    assert len(mine) == 1 and mine[0]["merchant_name"] == "小店"
    shop_order = mine[0]["order_id"]

    assert client.post(f"/merchant/orders/{shop_order}/ship", json={"carrier": "顺丰", "tracking_no": "SF1"}, headers=mh).status_code == 409
    client.post(f"/orders/{shop_order}/pay", headers=ch)
    shipped = client.post(f"/merchant/orders/{shop_order}/ship", json={"carrier": "顺丰", "tracking_no": "SF1"}, headers=mh)
    assert shipped.json()["order"]["status"] == "shipped"

    # The platform order is not the shop's to ship.
    platform_order = next(o for o in oid if o != shop_order)
    client.post(f"/orders/{platform_order}/pay", headers=ch)
    assert client.post(f"/merchant/orders/{platform_order}/ship", json={"carrier": "顺丰", "tracking_no": "X"}, headers=mh).status_code == 404

    refund = client.post(f"/orders/{shop_order}/refund", json={"reason": "不想要了"}, headers=ch).json()["order"]
    assert refund["status"] == "refund_requested"
    rejected = client.post(f"/merchant/orders/{shop_order}/refund/reject", headers=mh).json()["order"]
    assert rejected["status"] == "shipped"
    client.post(f"/orders/{shop_order}/refund", json={"reason": "破损"}, headers=ch)
    approved = client.post(f"/merchant/orders/{shop_order}/refund/approve", headers=mh).json()["order"]
    assert approved["status"] == "refunded"
    assert _stock(db, f"{pid}_s1") == 10

    stats = client.get("/merchant/stats", headers=mh).json()
    assert stats["product_count"] == 1
    assert stats["status_counts"]["refunded"] == 1


def test_merchant_edits_sku_and_delists(client):
    mh = _auth(_register(client, "shop", role="merchant", shop_name="小店")["token"])
    other = _auth(_register(client, "shop2", role="merchant", shop_name="别家")["token"])
    pid = client.post(
        "/merchant/products",
        json={
            "title": "帆布包", "brand": "小店", "category": "服饰运动", "image_url": "https://img/bag.jpg",
            "skus": [{"properties": {"颜色": "米白"}, "price": 59, "stock_qty": 4}],
        },
        headers=mh,
    ).json()["product"]["product_id"]

    assert client.put(f"/merchant/products/{pid}", json={"title": "x"}, headers=other).status_code == 404

    product = client.put(
        f"/merchant/products/{pid}/skus",
        json={"properties": {"颜色": "黑"}, "price": 49, "stock_qty": 8},
        headers=mh,
    ).json()["product"]
    assert len(product["skus"]) == 2
    assert product["base_price"] == 49

    delisted = client.post(f"/merchant/products/{pid}/status", json={"status": "inactive"}, headers=mh).json()["product"]
    assert delisted["status"] == "inactive"
    r = client.post("/orders", json={"items": [{"productID": pid}]}, headers=mh)
    assert r.status_code == 404


def test_address_book_default_promotion(db):
    store = AddressStore(db)
    a = store.create("u1", recipient="甲", phone="13800000001", detail="一号")
    b = store.create("u1", recipient="乙", phone="13800000002", detail="二号", is_default=True)
    assert store.default("u1").address_id == b.address_id
    assert store.delete("u1", b.address_id)
    assert store.default("u1").address_id == a.address_id
    assert store.get("u2", a.address_id) is None
