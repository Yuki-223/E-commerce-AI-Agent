from __future__ import annotations

"""Incremental Chroma sync for merchant catalog edits.

``build_chroma`` indexes the bundled JSON files in one batch. Merchant products live
only in SQLite, so after a create, edit, or delist the API calls ``sync_product``: it
rebuilds that product's chunks from SQLite with the same chunk builders and replaces
them in the collection, or removes them when the product is no longer active.

BM25 needs no sync: ``SearchService`` reads its corpus from SQLite on every query.
Set ``RAG_SYNC_ON_WRITE=0`` to skip the Chroma sync, for example without embedding
credentials, and run ``python -m rag.sync --all`` later.
"""

import argparse
import logging
import os
import sqlite3
from pathlib import Path
from typing import Any

from store.product_store import DEFAULT_DB_PATH, load_json_text


logger = logging.getLogger(__name__)


def sync_enabled() -> bool:
    return os.getenv("RAG_SYNC_ON_WRITE", "1").strip().lower() not in {"0", "false", "no", "off"}


def product_document(conn: sqlite3.Connection, product_id: str) -> dict[str, Any] | None:
    """Rebuild the JSON-source shape ``build_chunks`` expects; ``None`` when not active."""
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT p.*, COALESCE(d.marketing_description, '') AS marketing_description "
        "FROM products p LEFT JOIN product_descriptions d ON d.product_id = p.product_id "
        "WHERE p.product_id = ? AND p.status = 'active'",
        (product_id,),
    ).fetchone()
    if row is None:
        return None
    skus = conn.execute(
        "SELECT properties_json, price FROM product_skus WHERE product_id = ? AND status = 'active' ORDER BY price",
        (product_id,),
    ).fetchall()
    faqs = conn.execute(
        "SELECT question, answer FROM product_faqs WHERE product_id = ? ORDER BY source_index", (product_id,)
    ).fetchall()
    reviews = conn.execute(
        "SELECT nickname, rating, content FROM product_reviews WHERE product_id = ? ORDER BY source_index",
        (product_id,),
    ).fetchall()
    return {
        "product_id": row["product_id"],
        "title": row["title"],
        "brand": row["brand"],
        "category": row["category"],
        "sub_category": row["sub_category"] or "",
        "base_price": float(row["base_price"]),
        "image_path": row["image_path"] or row["image_url"] or "",
        "skus": [{"properties": load_json_text(s["properties_json"]), "price": float(s["price"])} for s in skus],
        "rag_knowledge": {
            "marketing_description": row["marketing_description"],
            "official_faq": [dict(f) for f in faqs],
            "user_reviews": [dict(r) for r in reviews],
        },
    }


def sync_product(product_id: str, *, db_path: Path = DEFAULT_DB_PATH, collection: Any = None) -> int:
    """Replace one product's chunks in Chroma; returns the number of chunks written."""
    from rag.build_chroma import build_chunks, upsert_chunks

    if collection is None:
        from rag.chroma_store import create_collection

        collection = create_collection()
    with sqlite3.connect(db_path) as conn:
        product = product_document(conn, product_id)
    collection.delete(where={"product_id": product_id})
    if product is None:
        return 0
    chunks = build_chunks(product)
    upsert_chunks(collection, chunks, batch_size=64)
    return len(chunks)


def sync_product_safely(product_id: str) -> None:
    """Background-task entry point: never raises, logs failures."""
    if not sync_enabled():
        return
    try:
        written = sync_product(product_id)
        logger.info("rag sync %s: %d chunks", product_id, written)
    except Exception:  # noqa: BLE001 - a failed sync must not fail the merchant's edit
        logger.exception("rag sync failed for %s; run `python -m rag.sync --product %s`", product_id, product_id)


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync merchant products from SQLite into Chroma")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--product", help="One product_id")
    group.add_argument("--all", action="store_true", help="Every merchant-owned product")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH)
    args = parser.parse_args()

    from rag.chroma_store import create_collection

    collection = create_collection()
    if args.product:
        ids = [args.product]
    else:
        with sqlite3.connect(args.db) as conn:
            ids = [r[0] for r in conn.execute("SELECT product_id FROM products WHERE merchant_id IS NOT NULL")]
    for product_id in ids:
        print(f"{product_id}: {sync_product(product_id, db_path=args.db, collection=collection)} chunks")


if __name__ == "__main__":
    main()
