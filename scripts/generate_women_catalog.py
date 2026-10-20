#!/usr/bin/env python3
"""Generate the women's supply catalog under data/ from scripts/women_catalog_spec.py.

    python3 scripts/generate_women_catalog.py

Writes, replacing the previous catalog:
    data/<n>_<category>/data/<product_id>.json   product facts + RAG knowledge + attributes
    data/<n>_<category>/images/<product_id>.svg  placeholder artwork
    backend/storage/compare_index.json           comparison dimensions (no LLM needed)
    backend/cdn/image_manifest.json              emptied: images are served locally
    backend/storage/image_index.json             emptied: rebuild with rag.build_image_index

Afterwards rebuild SQLite and Chroma:
    cd backend && python -m store.import_product_data --reset && python -m rag.build_chroma --reset
"""

from __future__ import annotations

import json
import shutil
import sys
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from women_catalog_spec import CATEGORIES, PRODUCTS  # noqa: E402

PREGNANCY_ANSWER = {
    "safe": "可以。{note}。",
    "caution": "需要谨慎。{note}。",
    "avoid": "不建议。{note}。",
}

# Soft per-category palettes for the placeholder artwork.
PALETTE = {
    "运动营养": ("#F6D9CF", "#C9705A"),
    "女性营养素": ("#F3E3C7", "#B07C2E"),
    "经期关怀": ("#F4D4DC", "#B4506A"),
    "运动服饰": ("#D8E3E8", "#4E7486"),
    "运动修护": ("#DCE8DA", "#5B7F57"),
    "功能轻食": ("#EFE2D3", "#8A6440"),
}

PHASE_LABELS = {"menstrual": "经期", "follicular": "卵泡期", "ovulatory": "排卵期", "luteal": "黄体期"}


def svg(product: dict) -> str:
    bg, fg = PALETTE[product["cat"]]
    brand = escape(product["brand"].split()[0])
    sub = escape(product["sub"])
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs><radialGradient id="g" cx="30%" cy="25%" r="90%"><stop offset="0" stop-color="#ffffff" stop-opacity="0.75"/><stop offset="1" stop-color="{bg}"/></radialGradient></defs>
  <rect width="400" height="400" fill="url(#g)"/>
  <circle cx="320" cy="80" r="120" fill="{fg}" opacity="0.08"/>
  <circle cx="70" cy="350" r="90" fill="{fg}" opacity="0.07"/>
  <rect x="120" y="96" width="160" height="196" rx="34" fill="#ffffff" opacity="0.9"/>
  <rect x="150" y="76" width="100" height="34" rx="12" fill="{fg}" opacity="0.85"/>
  <text x="200" y="196" text-anchor="middle" font-family="PingFang SC, Noto Sans CJK SC, sans-serif" font-size="30" font-weight="600" fill="{fg}">{sub}</text>
  <text x="200" y="236" text-anchor="middle" font-family="PingFang SC, Noto Sans CJK SC, sans-serif" font-size="18" fill="{fg}" opacity="0.75">{brand}</text>
  <text x="200" y="352" text-anchor="middle" font-family="Georgia, serif" font-size="16" letter-spacing="3" fill="{fg}" opacity="0.6">CARTPILOT · HER</text>
</svg>
"""


def attributes(p: dict) -> dict:
    return {
        "ingredients": p["ingredients"],
        "allergens": p["allergens"],
        "pregnancy": p["pregnancy"],
        "pregnancy_note": p["pregnancy_note"],
        "caffeine": p["caffeine"],
        "fragrance": p["fragrance"],
        "alcohol": p["alcohol"],
        "vegan": p["vegan"],
        "tags": p["tags"],
        "cycle_phases": p["phases"],
    }


def safety_sentence(p: dict) -> str:
    """Appended to the RAG description so retrieval and the composer see the facts."""
    bits = [f"主要成分：{'、'.join(p['ingredients'])}"]
    bits.append(f"过敏原：{'、'.join(p['allergens']) if p['allergens'] else '无常见过敏原'}")
    bits.append("含咖啡因" if p["caffeine"] else "不含咖啡因")
    bits.append("含香精" if p["fragrance"] else "无香精")
    bits.append("纯素" if p["vegan"] else "含动物来源成分")
    bits.append(f"孕期哺乳期：{ {'safe': '一般可用', 'caution': '谨慎使用', 'avoid': '不建议'}[p['pregnancy']] }")
    phases = "、".join(PHASE_LABELS[x] for x in p["phases"])
    bits.append(f"适合的周期阶段：{phases}")
    return "【配料与安全】" + "；".join(bits) + "。"


def spec_answer(p: dict) -> str:
    options = []
    for props, price in p["skus"][:8]:
        options.append(f"{'，'.join(f'{k}：{v}' for k, v in props.items())}（¥{price:g}）")
    more = f"等共{len(p['skus'])}个规格" if len(p["skus"]) > 8 else ""
    return f"目前有{'；'.join(options)}{more}。" + (p["usage"] if "尺码" in p["usage"] or "码" in p["usage"] else "按使用频率选择规格，第一次尝试建议选小规格。")


def product_json(p: dict, folder: str) -> dict:
    skus = [
        {"sku_id": f"s_{p['pid']}_{i}", "properties": props, "price": float(price)}
        for i, (props, price) in enumerate(p["skus"], start=1)
    ]
    faqs = [
        {"question": "孕期、哺乳期或备孕可以用吗？", "answer": PREGNANCY_ANSWER[p["pregnancy"]].format(note=p["pregnancy_note"])},
        {"question": "怎么使用？什么时候用最合适？", "answer": p["usage"]},
        {"question": "规格怎么选？", "answer": spec_answer(p)},
        {"question": p["faq"][0], "answer": p["faq"][1]},
    ]
    return {
        "product_id": p["pid"],
        "title": p["title"],
        "brand": p["brand"],
        "category": p["cat"],
        "sub_category": p["sub"],
        "base_price": float(min(price for _, price in p["skus"])),
        "image_path": f"{folder}/images/{p['pid']}.svg",
        "skus": skus,
        "attributes": attributes(p),
        "rag_knowledge": {
            "marketing_description": p["desc"] + safety_sentence(p),
            "official_faq": faqs,
            "user_reviews": [{"nickname": n, "rating": r, "content": c} for n, r, c in p["reviews"]],
        },
    }


def main() -> None:
    data = ROOT / "data"
    folder_of = {cat: folder for folder, cat in CATEGORIES}
    # Replace the whole catalog: old category folders go, new ones are written fresh.
    for child in data.iterdir():
        if child.is_dir():
            shutil.rmtree(child)
    compare: dict[str, dict] = {}
    seen: set[str] = set()
    for p in PRODUCTS:
        if p["pid"] in seen:
            raise SystemExit(f"duplicate product id {p['pid']}")
        seen.add(p["pid"])
        folder = folder_of[p["cat"]]
        (data / folder / "data").mkdir(parents=True, exist_ok=True)
        (data / folder / "images").mkdir(parents=True, exist_ok=True)
        doc = product_json(p, folder)
        (data / folder / "data" / f"{p['pid']}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (data / folder / "images" / f"{p['pid']}.svg").write_text(svg(p), encoding="utf-8")
        compare[p["pid"]] = {
            "dims": {**p["dims"], "品牌定位": p["brand"].split()[0], "核心卖点": "、".join(p["tags"]), "适用场景": p["dims"].get("适用场景") or p["dims"].get("使用场景") or p["dims"].get("食用场景") or p["tagline"]},
            "tagline": p["tagline"],
        }
    (ROOT / "backend" / "storage" / "compare_index.json").write_text(json.dumps(compare, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "backend" / "cdn" / "image_manifest.json").write_text("{}\n", encoding="utf-8")
    (ROOT / "backend" / "storage" / "image_index.json").write_text("{}\n", encoding="utf-8")
    print(f"wrote {len(PRODUCTS)} products in {len(CATEGORIES)} categories")


if __name__ == "__main__":
    main()
