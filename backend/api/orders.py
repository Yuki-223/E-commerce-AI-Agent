from __future__ import annotations

"""Shopper order and address endpoints.

    GET  /orders?status=             my orders, newest first
    GET  /orders/{id}                one order
    POST /orders/{id}/pay            simulated payment
    POST /orders/{id}/cancel         cancel an unpaid order (stock is released)
    POST /orders/{id}/confirm        confirm receipt of a shipped order
    POST /orders/{id}/refund         request a refund for a paid or shipped order
    GET/POST/PUT/DELETE /addresses   address book

``POST /orders`` (checkout) stays in main.py next to the cart it consumes.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.auth import shopper_id
from store.address_store import AddressStore
from store.order_store import Order, OrderError, OrderNotFoundError, OrderStore, OutOfStockError, STATUS_LABELS


router = APIRouter()


def order_http_error(exc: OrderError) -> HTTPException:
    if isinstance(exc, OrderNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, OutOfStockError):
        return HTTPException(status_code=409, detail=str(exc))
    return HTTPException(status_code=409, detail=str(exc))


def status_filter(status: str | None) -> str | None:
    if status and status not in STATUS_LABELS:
        raise HTTPException(status_code=400, detail=f"未知的订单状态：{status}")
    return status or None


def _run(action) -> dict[str, Any]:
    try:
        order: Order = action()
    except OrderError as exc:
        raise order_http_error(exc) from exc
    return {"order": order.to_dict()}


@router.get("/orders")
def list_orders(status: str | None = None, user_id: str = Depends(shopper_id)) -> dict[str, Any]:
    orders = OrderStore().list_for_user(user_id, status_filter(status))
    return {"orders": [order.to_dict() for order in orders]}


@router.get("/orders/{order_id}")
def get_order(order_id: str, user_id: str = Depends(shopper_id)) -> dict[str, Any]:
    return _run(lambda: OrderStore().get(order_id, user_id=user_id))


@router.post("/orders/{order_id}/pay")
def pay_order(order_id: str, user_id: str = Depends(shopper_id)) -> dict[str, Any]:
    return _run(lambda: OrderStore().pay(order_id, user_id))


@router.post("/orders/{order_id}/cancel")
def cancel_order(order_id: str, user_id: str = Depends(shopper_id)) -> dict[str, Any]:
    return _run(lambda: OrderStore().cancel(order_id, user_id))


@router.post("/orders/{order_id}/confirm")
def confirm_order(order_id: str, user_id: str = Depends(shopper_id)) -> dict[str, Any]:
    return _run(lambda: OrderStore().confirm_receipt(order_id, user_id))


class RefundRequest(BaseModel):
    reason: str = Field("", max_length=200)


@router.post("/orders/{order_id}/refund")
def refund_order(order_id: str, req: RefundRequest, user_id: str = Depends(shopper_id)) -> dict[str, Any]:
    return _run(lambda: OrderStore().request_refund(order_id, user_id, req.reason))


# ---------------------------------------------------------------------------
# Address book
# ---------------------------------------------------------------------------

class AddressRequest(BaseModel):
    recipient: str = Field(..., min_length=1, max_length=32)
    phone: str = Field(..., min_length=5, max_length=20)
    region: str = Field("", max_length=64)
    detail: str = Field(..., min_length=1, max_length=200)
    is_default: bool = False


class AddressPatch(BaseModel):
    recipient: str | None = Field(None, min_length=1, max_length=32)
    phone: str | None = Field(None, min_length=5, max_length=20)
    region: str | None = Field(None, max_length=64)
    detail: str | None = Field(None, min_length=1, max_length=200)
    is_default: bool | None = None


@router.get("/addresses")
def list_addresses(user_id: str = Depends(shopper_id)) -> dict[str, Any]:
    return {"addresses": [a.to_dict() for a in AddressStore().list(user_id)]}


@router.post("/addresses")
def create_address(req: AddressRequest, user_id: str = Depends(shopper_id)) -> dict[str, Any]:
    address = AddressStore().create(user_id, **req.model_dump())
    return {"address": address.to_dict()}


@router.put("/addresses/{address_id}")
def update_address(address_id: int, req: AddressPatch, user_id: str = Depends(shopper_id)) -> dict[str, Any]:
    address = AddressStore().update(user_id, address_id, **req.model_dump())
    if address is None:
        raise HTTPException(status_code=404, detail="地址不存在")
    return {"address": address.to_dict()}


@router.delete("/addresses/{address_id}")
def delete_address(address_id: int, user_id: str = Depends(shopper_id)) -> dict[str, Any]:
    if not AddressStore().delete(user_id, address_id):
        raise HTTPException(status_code=404, detail="地址不存在")
    return {"status": "deleted"}
