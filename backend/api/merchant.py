from __future__ import annotations

"""Merchant console endpoints, all under ``/merchant`` and limited to the caller's shop.

    GET  /merchant/shop                      shop profile
    PUT  /merchant/shop                      rename / describe the shop
    GET  /merchant/stats                     dashboard numbers
    GET  /merchant/products?status=          own products (active and inactive)
    POST /merchant/products                  publish a product with its SKUs
    GET  /merchant/products/{id}
    PUT  /merchant/products/{id}             edit title, category, image, description
    POST /merchant/products/{id}/status      list / delist
    PUT  /merchant/products/{id}/skus        update or add one SKU (price, stock, status)
    GET  /merchant/orders?status=            orders containing the shop's products
    POST /merchant/orders/{id}/ship          fill in carrier and tracking number
    POST /merchant/orders/{id}/refund/approve
    POST /merchant/orders/{id}/refund/reject

Catalog writes schedule an incremental Chroma sync (``rag.sync``) so the shopping
agent can recommend new products and stops recalling delisted ones.
"""

from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

from api.auth import accounts, merchant_scope
from api.orders import order_http_error, status_filter
from rag.sync import sync_product_safely
from store.merchant_store import CatalogError, MerchantStore, ProductNotOwnedError, SkuInput
from store.order_store import ADMIN_SCOPE, OrderError, OrderStore


router = APIRouter(prefix="/merchant")


def _catalog_call(action) -> dict[str, Any]:
    try:
        return action()
    except ProductNotOwnedError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except CatalogError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _order_call(action) -> dict[str, Any]:
    try:
        return {"order": action().to_dict()}
    except OrderError as exc:
        raise order_http_error(exc) from exc


# ---------------------------------------------------------------------------
# Shop and dashboard
# ---------------------------------------------------------------------------

class ShopPatch(BaseModel):
    name: str | None = Field(None, max_length=40)
    description: str | None = Field(None, max_length=500)


@router.get("/shop")
def get_shop(scope: str = Depends(merchant_scope)) -> dict[str, Any]:
    if scope == ADMIN_SCOPE:
        return {"merchant": None, "admin": True}
    merchant = accounts().get_merchant(scope)
    return {"merchant": merchant.to_dict() if merchant else None, "admin": False}


@router.put("/shop")
def update_shop(req: ShopPatch, scope: str = Depends(merchant_scope)) -> dict[str, Any]:
    if scope == ADMIN_SCOPE:
        raise HTTPException(status_code=400, detail="平台账号没有店铺资料")
    merchant = accounts().update_merchant(scope, name=req.name, description=req.description)
    return {"merchant": merchant.to_dict() if merchant else None, "admin": False}


@router.get("/stats")
def stats(scope: str = Depends(merchant_scope)) -> dict[str, Any]:
    orders = OrderStore().merchant_stats(scope)
    products = MerchantStore().list_products(scope)
    return {
        **orders,
        "product_count": len(products),
        "active_product_count": sum(1 for p in products if p["status"] == "active"),
        "low_stock": [
            {"product_id": p["product_id"], "title": p["title"], "total_stock": p["total_stock"]}
            for p in products
            if p["status"] == "active" and p["total_stock"] <= 10
        ][:10],
    }


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------

class SkuBody(BaseModel):
    sku_id: str | None = None
    properties: dict[str, str] = Field(default_factory=dict)
    price: float = Field(..., ge=0)
    stock_qty: int = Field(..., ge=0)
    status: str = "active"

    def to_input(self) -> SkuInput:
        return SkuInput(
            properties={str(k).strip(): str(v).strip() for k, v in self.properties.items() if str(k).strip()},
            price=round(self.price, 2),
            stock_qty=self.stock_qty,
            sku_id=self.sku_id,
            status=self.status,
        )


class ProductCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=80)
    brand: str = Field(..., min_length=1, max_length=40)
    category: str = Field(..., min_length=1, max_length=20)
    sub_category: str = Field("", max_length=20)
    image_url: str = Field(..., min_length=1, max_length=500)
    description: str = Field("", max_length=2000)
    skus: list[SkuBody] = Field(..., min_length=1, max_length=50)


class ProductPatch(BaseModel):
    title: str | None = Field(None, max_length=80)
    brand: str | None = Field(None, max_length=40)
    category: str | None = Field(None, max_length=20)
    sub_category: str | None = Field(None, max_length=20)
    image_url: str | None = Field(None, max_length=500)
    description: str | None = Field(None, max_length=2000)


class StatusBody(BaseModel):
    status: str = Field(..., description="active 或 inactive")


@router.get("/products")
def list_products(status: str | None = None, scope: str = Depends(merchant_scope)) -> dict[str, Any]:
    return {"products": MerchantStore().list_products(scope, status or None)}


@router.post("/products")
def create_product(req: ProductCreate, tasks: BackgroundTasks, scope: str = Depends(merchant_scope)) -> dict[str, Any]:
    body = req.model_dump(exclude={"skus"})
    product = _catalog_call(
        lambda: MerchantStore().create_product(scope, **body, skus=[s.to_input() for s in req.skus])
    )
    tasks.add_task(sync_product_safely, product["product_id"])
    return {"product": product}


@router.get("/products/{product_id}")
def get_product(product_id: str, scope: str = Depends(merchant_scope)) -> dict[str, Any]:
    return {"product": _catalog_call(lambda: MerchantStore().get_product(scope, product_id))}


@router.put("/products/{product_id}")
def update_product(
    product_id: str, req: ProductPatch, tasks: BackgroundTasks, scope: str = Depends(merchant_scope)
) -> dict[str, Any]:
    product = _catalog_call(lambda: MerchantStore().update_product(scope, product_id, **req.model_dump()))
    tasks.add_task(sync_product_safely, product_id)
    return {"product": product}


@router.post("/products/{product_id}/status")
def set_product_status(
    product_id: str, req: StatusBody, tasks: BackgroundTasks, scope: str = Depends(merchant_scope)
) -> dict[str, Any]:
    product = _catalog_call(lambda: MerchantStore().set_status(scope, product_id, req.status))
    tasks.add_task(sync_product_safely, product_id)
    return {"product": product}


@router.put("/products/{product_id}/skus")
def upsert_sku(
    product_id: str, req: SkuBody, tasks: BackgroundTasks, scope: str = Depends(merchant_scope)
) -> dict[str, Any]:
    product = _catalog_call(lambda: MerchantStore().upsert_sku(scope, product_id, req.to_input()))
    tasks.add_task(sync_product_safely, product_id)
    return {"product": product}


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------

class ShipBody(BaseModel):
    carrier: str = Field(..., min_length=1, max_length=20)
    tracking_no: str = Field(..., min_length=1, max_length=40)


@router.get("/orders")
def list_orders(status: str | None = None, scope: str = Depends(merchant_scope)) -> dict[str, Any]:
    orders = OrderStore().list_for_merchant(scope, status_filter(status))
    return {"orders": [order.to_dict() for order in orders]}


@router.post("/orders/{order_id}/ship")
def ship_order(order_id: str, req: ShipBody, scope: str = Depends(merchant_scope)) -> dict[str, Any]:
    return _order_call(lambda: OrderStore().ship(order_id, scope, req.carrier, req.tracking_no))


@router.post("/orders/{order_id}/refund/approve")
def approve_refund(order_id: str, scope: str = Depends(merchant_scope)) -> dict[str, Any]:
    return _order_call(lambda: OrderStore().approve_refund(order_id, scope))


@router.post("/orders/{order_id}/refund/reject")
def reject_refund(order_id: str, scope: str = Depends(merchant_scope)) -> dict[str, Any]:
    return _order_call(lambda: OrderStore().reject_refund(order_id, scope))
