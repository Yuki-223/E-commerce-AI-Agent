from __future__ import annotations

"""LLM-first query-understanding orchestration.

This module owns the data contract, orchestration, caching, and deterministic safeguards.
``search.llm_parser`` performs the primary natural-language-to-``ParsedQuery`` extraction.

When LLM parsing fails, retrieval keeps the raw query and omits inferred positive hard
filters. Small deterministic negative-category and brand safeguards preserve explicit
exclusions without attempting to replace full language understanding.

Dependency direction:
    ``llm_parser`` imports this module's contracts and taxonomy helpers; API and agent
    layers call only ``understand_query``.
"""

import argparse
import json
import logging
import os
import re
import sqlite3
from dataclasses import asdict, dataclass, field, fields, replace
from functools import lru_cache
from pathlib import Path


logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = PROJECT_ROOT / "backend" / "storage" / "ecommerce_agent.sqlite3"


# ---------------------------------------------------------------------------
# 1. Data contract
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ParsedQuery:
    """Structured retrieval intent consumed by every downstream module."""

    original_query: str
    intent: str = "product_search"
    category: str | None = None
    sub_category: str | None = None
    category_exclude: list[str] = field(default_factory=list)
    sub_category_exclude: list[str] = field(default_factory=list)
    max_price: float | None = None
    min_price: float | None = None
    brand_include: list[str] = field(default_factory=list)
    brand_exclude: list[str] = field(default_factory=list)
    negative_ingredients: list[str] = field(default_factory=list)
    soft_terms: list[str] = field(default_factory=list)
    retrieval_query: str = ""
    needs_clarification: bool = False

    @property
    def hard_filters(self) -> dict[str, object]:
        """Return hard filters suitable for SQLite or Chroma."""
        return {
            "category": self.category,
            "sub_category": self.sub_category,
            "category_exclude": self.category_exclude,
            "sub_category_exclude": self.sub_category_exclude,
            "max_price": self.max_price,
            "min_price": self.min_price,
            "brand_include": self.brand_include,
            "brand_exclude": self.brand_exclude,
        }

    def to_dict(self) -> dict[str, object]:
        data = asdict(self)
        data["hard_filters"] = self.hard_filters
        return data

    @classmethod
    def from_dict(cls, data: dict[str, object]) -> "ParsedQuery":
        """Restore an instance from ``to_dict`` output.

        Unknown keys are ignored, especially the derived ``hard_filters`` property that
        is not a constructor argument.
        """
        allowed = {f.name for f in fields(cls)}
        return cls(**{k: v for k, v in data.items() if k in allowed})

    def merge_base(self, base: "ParsedQuery") -> "ParsedQuery":
        """Overlay the current parsed turn on the previous structured intent.

        Scalar category and price fields override only when present. A non-empty brand
        inclusion replaces the old brand, while exclusions, negative ingredients, and
        soft preferences accumulate. Retrieval terms are merged with current terms first,
        and inherited context makes clarification unnecessary.
        """
        def pick(cur: object, prev: object) -> object:
            return cur if cur is not None else prev

        def union(cur: list, prev: list) -> list:
            return list(dict.fromkeys(list(prev or []) + list(cur or [])))

        def replace_or_keep(cur: list, prev: list) -> list:
            return list(cur) if cur else list(prev or [])

        tokens: list[str] = []
        for tok in (self.retrieval_query or "").split() + (base.retrieval_query or "").split():
            if tok and tok not in tokens:
                tokens.append(tok)
        retrieval_query = " ".join(tokens) or self.original_query or base.original_query

        return ParsedQuery(
            original_query=self.original_query or base.original_query,
            intent=self.intent or base.intent,
            category=pick(self.category, base.category),
            sub_category=pick(self.sub_category, base.sub_category),
            category_exclude=union(self.category_exclude, base.category_exclude),
            sub_category_exclude=union(self.sub_category_exclude, base.sub_category_exclude),
            max_price=pick(self.max_price, base.max_price),
            min_price=pick(self.min_price, base.min_price),
            brand_include=replace_or_keep(self.brand_include, base.brand_include),
            brand_exclude=union(self.brand_exclude, base.brand_exclude),
            negative_ingredients=union(self.negative_ingredients, base.negative_ingredients),
            soft_terms=union(self.soft_terms, base.soft_terms),
            retrieval_query=retrieval_query,
            needs_clarification=False,
        )


# ---------------------------------------------------------------------------
# 2. Taxonomy derived from SQLite for function-schema enums
# ---------------------------------------------------------------------------

# Canonical brand keys map to every SQLite/Chroma spelling, including the canonical name.
# Bilingual catalog brands ("她力 HerPower") also get each half as an alias automatically
# (see _bilingual_aliases); list extra spellings here.
BRAND_ALIASES: dict[str, tuple[str, ...]] = {}

_EXTRA_BRAND_ALIASES: dict[str, tuple[str, ...]] = {}


def _bilingual_aliases(raw_brands: set[str] | list[str]) -> dict[str, tuple[str, ...]]:
    """"她力 HerPower" → ("她力 HerPower", "她力", "HerPower")."""
    out: dict[str, tuple[str, ...]] = {}
    for raw in raw_brands:
        parts = [part for part in raw.split() if part]
        if len(parts) > 1:
            out[raw] = (raw, *parts)
    return out


def _brand_aliases(raw_brands: set[str] | list[str]) -> dict[str, tuple[str, ...]]:
    merged = dict(_bilingual_aliases(raw_brands))
    for canonical, variants in BRAND_ALIASES.items():
        merged[canonical] = tuple(dict.fromkeys(merged.get(canonical, ()) + variants))
    return merged


@lru_cache(maxsize=1)
def load_taxonomy(db_path: Path = DEFAULT_DB_PATH) -> dict[str, object]:
    """Read distinct category, subcategory, and brand values from ``products``.

    The result maps subcategories to parents, exposes canonical brands for the LLM enum,
    and expands canonical brands to stored variants. It is cached once per process.
    """
    if not db_path.exists():
        return {"sub_to_cat": {}, "brands": [], "brand_expand": {}, "aliases": {}}

    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            "SELECT DISTINCT category, sub_category, brand FROM products"
        ).fetchall()

    sub_to_cat: dict[str, str] = {}
    raw_brands: set[str] = set()
    for category, sub_category, brand in rows:
        if sub_category:
            sub_to_cat[sub_category] = category
        if brand:
            raw_brands.add(brand)

    aliases = _brand_aliases(raw_brands)
    # Reverse variant-to-canonical index.
    variant_to_canonical: dict[str, str] = {}
    for canonical, variants in aliases.items():
        for variant in variants:
            variant_to_canonical[variant] = canonical

    # Map stored brands to canonical values and collapse duplicates.
    canonicals: set[str] = set()
    brand_expand: dict[str, list[str]] = {}
    for raw in raw_brands:
        canonical = variant_to_canonical.get(raw, raw)
        canonicals.add(canonical)
        brand_expand.setdefault(canonical, []).append(raw)

    # Include every alias spelling so $in / $nin and text matches catch all of them.
    for canonical, variants in aliases.items():
        if canonical in canonicals:
            existing = set(brand_expand[canonical])
            for variant in variants:
                if variant not in existing:
                    brand_expand[canonical].append(variant)

    return {
        "sub_to_cat": sub_to_cat,
        "brands": sorted(canonicals),
        "brand_expand": brand_expand,
        "aliases": aliases,
    }


def expand_brands(canonical_brands: list[str]) -> list[str]:
    """Expand canonical brands (or any alias) to stored variants for ``$in`` and ``$nin``."""
    taxonomy = load_taxonomy()
    expand: dict[str, list[str]] = taxonomy["brand_expand"]  # type: ignore[assignment]
    aliases: dict[str, tuple[str, ...]] = dict(taxonomy.get("aliases") or {})  # type: ignore[arg-type]
    for canonical, variants in {**BRAND_ALIASES, **_EXTRA_BRAND_ALIASES}.items():
        aliases[canonical] = tuple(dict.fromkeys(aliases.get(canonical, ()) + variants))
    variant_to_canonical: dict[str, str] = {}
    for canonical, variants in aliases.items():
        for variant in variants:
            variant_to_canonical[variant] = canonical
    out: list[str] = []
    seen: set[str] = set()
    for raw in canonical_brands:
        canonical = variant_to_canonical.get(raw, raw)
        variants = list(expand.get(canonical, [canonical]))
        for extra in aliases.get(canonical, ()):
            if extra not in variants:
                variants.append(extra)
        for variant in variants:
            if variant not in seen:
                seen.add(variant)
                out.append(variant)
    return out


# ---------------------------------------------------------------------------
# 3. Postfilter vocabulary
# ---------------------------------------------------------------------------

# This stable vocabulary constrains extraction and supports keyword postfiltering. Add a
# term only after confirming that it appears in catalog text.
INGREDIENT_BLOCKLIST: tuple[str, ...] = (
    "酒精", "乙醇", "香精", "色素", "防腐剂",
    "糖", "蔗糖", "咖啡因", "咖啡",
    "乳制品", "乳糖", "大豆", "坚果", "麸质", "鱼",
)


# ---------------------------------------------------------------------------
# 4. Orchestration entry point
# ---------------------------------------------------------------------------

_PRICE_WORDING_RE = re.compile(
    r"(?:预算)?\d{1,6}(?:\.\d+)?\s*(?:元|块|rmb|RMB)?\s*(?:以内|以下|之内|以上|左右|上下)"
    r"|(?:预算)?\d{1,6}(?:\.\d+)?\s*(?:元|块)"
)


def drop_conditions(parsed: ParsedQuery, keys: list[str]) -> ParsedQuery:
    """Return ``parsed`` without the named constraints, for the web's condition chips.

    Keys match the chips: ``price``, ``neg:<ingredient>``, ``brand:<brand>``,
    ``nobrand:<brand>`` and ``soft:<term>``. Refinement merges can only add
    constraints, so a removed chip reruns the previous search through this instead.
    """
    drop = set(keys)

    def keep(prefix: str, values: list[str]) -> list[str]:
        return [v for v in values if f"{prefix}:{v}" not in drop]

    # The retrieval text still carries the wording ("300元以内", "不含酒精"); the composer
    # and the vector search both read it, so the dropped condition goes from there too.
    retrieval = parsed.retrieval_query
    if "price" in drop:
        retrieval = _PRICE_WORDING_RE.sub(" ", retrieval)
    for v in parsed.negative_ingredients:
        if f"neg:{v}" in drop:
            retrieval = re.sub(rf"(?:不要|不想要|不含|不带|没有|无)\s*含?\s*{re.escape(v)}的?", " ", retrieval)
    for v in parsed.soft_terms:
        if f"soft:{v}" in drop:
            retrieval = retrieval.replace(v, " ")
    retrieval = re.sub(r"^[\s、，,]+|[\s、，,]+$", "", re.sub(r"\s*[、，,]\s*(?=[、，,]|$)", "", retrieval))
    return replace(
        parsed,
        max_price=None if "price" in drop else parsed.max_price,
        min_price=None if "price" in drop else parsed.min_price,
        negative_ingredients=keep("neg", parsed.negative_ingredients),
        brand_include=keep("brand", parsed.brand_include),
        brand_exclude=keep("nobrand", parsed.brand_exclude),
        soft_terms=keep("soft", parsed.soft_terms),
        retrieval_query=" ".join(retrieval.split()),
    )


def normalize_query(query: str) -> str:
    return " ".join(query.strip().split())


@lru_cache(maxsize=1024)
def _cached_understand(normalized_query: str) -> ParsedQuery:
    # Delay the import so data-contract consumers do not require the OpenAI package.
    from search.llm_parser import parse_query_with_llm

    return parse_query_with_llm(normalized_query)


def understand_query(query: str) -> ParsedQuery:
    """Public query-understanding entry point for API, agent, and retrieval layers.

    Successful results use an in-process LRU cache. LLM failures keep the raw query for
    vector retrieval and skip inferred positive filters. Failed results are not cached,
    allowing a later retry.
    """
    normalized = normalize_query(query)
    if not normalized:
        return ParsedQuery(original_query=query, needs_clarification=True)
    try:
        parsed = _cached_understand(normalized)
        return _merge_regex_brand_excludes(parsed, query)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "LLM query understanding failed, degrade to vector-only recall: %r", exc
        )
        # Preserve raw vector retrieval plus deterministic explicit exclusions.
        sub_excl, cat_excl = _regex_extract_excludes(query)
        brand_excl = _regex_extract_brand_excludes(query)
        return ParsedQuery(
            original_query=query,
            retrieval_query=normalized,
            brand_exclude=brand_excl,
            sub_category_exclude=sub_excl,
            category_exclude=cat_excl,
            needs_clarification=False,
        )


def clear_cache() -> None:
    """Clear caches after taxonomy or prompt changes."""
    _cached_understand.cache_clear()
    load_taxonomy.cache_clear()


# Common lexical cues for explicit exclusion intent.
_NEGATION_CUES = ("不要", "不想要", "不想", "不含", "不带", "没有", "无", "非", "除了", "排除", "拒绝", "讨厌")

# Colloquial category aliases mapped to official taxonomy values for deterministic
# exclusion fallback. Values must exactly match stored subcategories.
_SUBCAT_SYNONYMS: dict[str, str] = {
    # Sports nutrition
    "乳清": "蛋白粉",
    "乳清蛋白": "蛋白粉",
    "增肌粉": "蛋白粉",
    "蛋白粉": "蛋白粉",
    "电解质水": "电解质",
    "盐丸": "电解质",
    "电解质": "电解质",
    "能量胶": "能量胶",
    "肌酸": "肌酸",
    "蛋白棒": "蛋白棒",
    "胶原": "胶原蛋白",
    "胶原蛋白": "胶原蛋白",
    "支链氨基酸": "BCAA",
    "bcaa": "BCAA",
    # Micronutrients
    "铁片": "铁剂",
    "补铁": "铁剂",
    "铁剂": "铁剂",
    "叶酸": "叶酸",
    "钙片": "钙与维生素D",
    "维生素d": "钙与维生素D",
    "镁": "镁",
    "鱼油": "鱼油",
    "多维": "复合维生素",
    "复合维生素": "复合维生素",
    "益生菌": "益生菌",
    "b12": "维生素B12",
    # Cycle care
    "姨妈巾": "卫生巾",
    "卫生巾": "卫生巾",
    "棉条": "卫生棉条",
    "卫生棉条": "卫生棉条",
    "月经杯": "月经杯",
    "安心裤": "经期内裤",
    "月经裤": "经期内裤",
    "经期内裤": "经期内裤",
    "暖宝宝": "暖宫贴",
    "暖贴": "暖宫贴",
    "暖宫贴": "暖宫贴",
    "姜茶": "经期茶饮",
    "私护": "私护清洁",
    # Sportswear
    "运动bra": "运动内衣",
    "运动文胸": "运动内衣",
    "运动内衣": "运动内衣",
    "瑜伽裤": "瑜伽裤",
    "跑步鞋": "跑鞋",
    "跑鞋": "跑鞋",
    "背心": "运动背心",
    "防晒衣": "防晒外套",
    "皮肤衣": "防晒外套",
    "骑行裤": "骑行短裤",
    "运动袜": "运动袜",
    # Recovery and care
    "防晒霜": "运动防晒",
    "防晒乳": "运动防晒",
    "素颜霜": "防晒隔离",
    "隔离": "防晒隔离",
    "止汗": "止汗露",
    "止汗露": "止汗露",
    "洗面奶": "洁面",
    "洁面": "洁面",
    "身体乳": "身体乳",
    "润唇膏": "润唇膏",
    "唇膏": "润唇膏",
    "按摩油": "肌肉放松",
    "发带": "发圈发带",
    # Functional food
    "燕麦": "燕麦",
    "坚果": "坚果",
    "黑巧": "巧克力",
    "巧克力": "巧克力",
    "酸奶": "酸奶",
    "轻食": "即食餐",
    "即食": "即食餐",
}


def _regex_extract_excludes(query: str) -> tuple[list[str], list[str]]:
    """Extract deterministic category exclusions when LLM parsing fails.

    Extraction requires an exclusion cue and accepts only real taxonomy values or mapped
    aliases, preventing unrelated negative phrases from becoming category filters.
    """
    text = query or ""
    if not any(cue in text for cue in _NEGATION_CUES):
        return [], []

    taxonomy = load_taxonomy()
    sub_to_cat = taxonomy.get("sub_to_cat", {}) or {}
    known_cats = {c for c in sub_to_cat.values() if c}

    # Split slash-delimited subcategories so either component can match the official value.
    sub_parts: dict[str, str] = {}
    for sub in sub_to_cat:
        for part in re.split(r"[/、，,]", sub):
            part = part.strip()
            if len(part) >= 2:
                sub_parts.setdefault(part, sub)

    sub_excl: list[str] = []
    cat_excl: list[str] = []

    def _add_sub(official: str) -> None:
        if official in sub_to_cat and official not in sub_excl:
            sub_excl.append(official)

    # Match aliases and official categories in a short window after each exclusion cue.
    for cue in _NEGATION_CUES:
        idx = text.find(cue)
        if idx < 0:
            continue
        window = text[idx + len(cue): idx + len(cue) + 12]
        # "不含酒精的清爽防晒" negates only what comes before 的 or a punctuation mark;
        # the noun after it is what the user wants.
        window = re.split(r"[的，。,；;！!？?\s]", window.lstrip(), maxsplit=1)[0]
        # "无糖饮品" / "无香精止汗露": the cue negates an ingredient, and the category noun
        # after it is what the user wants.
        if any(window.startswith(term) for term in INGREDIENT_BLOCKLIST):
            continue
        # 1. Colloquial alias to official subcategory.
        for syn, official in _SUBCAT_SYNONYMS.items():
            if syn in window:
                _add_sub(official)
        # 2. Direct official subcategory match.
        for sub in sub_to_cat:
            if sub in window:
                _add_sub(sub)
        # 3. Component of a slash-delimited official subcategory.
        for part, official in sub_parts.items():
            if part in window:
                _add_sub(official)
        # 4. Parent category match.
        for cat in known_cats:
            if cat in window and cat not in cat_excl:
                cat_excl.append(cat)

    return sub_excl, cat_excl


def _regex_extract_brand_excludes(query: str) -> list[str]:
    """Extract deterministic brand exclusions, including compact expressions."""
    text = query or ""
    if not any(cue in text for cue in _NEGATION_CUES):
        return []

    taxonomy = load_taxonomy()
    brands = list(taxonomy.get("brands", []) or [])
    aliases = {**(taxonomy.get("aliases") or {}), **BRAND_ALIASES}  # type: ignore[dict-item]
    for canonical, variants in aliases.items():
        if canonical not in brands:
            brands.append(canonical)
        for variant in variants:
            if variant not in brands:
                brands.append(variant)
    for canonical, variants in _EXTRA_BRAND_ALIASES.items():
        if canonical not in brands:
            brands.append(canonical)
        for variant in variants:
            if variant not in brands:
                brands.append(variant)

    excludes: list[str] = []
    for cue in _NEGATION_CUES:
        start = 0
        while True:
            idx = text.find(cue, start)
            if idx < 0:
                break
            # The existence-question pattern is not an exclusion cue.
            if cue == "没有" and idx > 0 and text[idx - 1] == "有":
                start = idx + len(cue)
                continue
            window = text[idx + len(cue): idx + len(cue) + 18]
            for brand in brands:
                if brand and brand in window and brand not in excludes:
                    excludes.append(brand)
            start = idx + len(cue)
    return excludes


def _drop_conflicting_excludes(
    brand_include: list[str] | None,
    brand_exclude: list[str],
) -> list[str]:
    """Remove exclusions that conflict with included brand variants.

    Variant-aware comparison prevents simultaneous ``$in`` and ``$nin`` filters for the
    same brand. Inclusion wins on conflict.
    """
    if not brand_include or not brand_exclude:
        return list(brand_exclude or [])
    inc_keys = {b.strip().lower().replace(" ", "") for b in expand_brands(brand_include)}
    out: list[str] = []
    for brand in brand_exclude:
        variants = {v.strip().lower().replace(" ", "") for v in expand_brands([brand])}
        if variants & inc_keys:
            continue
        out.append(brand)
    return out


def _merge_regex_brand_excludes(parsed: ParsedQuery, query: str) -> ParsedQuery:
    brand_excludes = list(parsed.brand_exclude or [])
    for brand in _regex_extract_brand_excludes(query):
        if brand not in brand_excludes:
            brand_excludes.append(brand)
    # A brand cannot be both included and excluded.
    brand_excludes = _drop_conflicting_excludes(parsed.brand_include, brand_excludes)
    if brand_excludes == list(parsed.brand_exclude or []):
        return parsed
    return ParsedQuery(
        original_query=parsed.original_query,
        intent=parsed.intent,
        category=parsed.category,
        sub_category=parsed.sub_category,
        category_exclude=parsed.category_exclude,
        sub_category_exclude=parsed.sub_category_exclude,
        max_price=parsed.max_price,
        min_price=parsed.min_price,
        brand_include=parsed.brand_include,
        brand_exclude=brand_excludes,
        negative_ingredients=parsed.negative_ingredients,
        soft_terms=parsed.soft_terms,
        retrieval_query=parsed.retrieval_query,
        needs_clarification=parsed.needs_clarification,
    )


# ---------------------------------------------------------------------------
# 5. CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Parse a user query into structured retrieval input")
    parser.add_argument("query")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH)
    return parser.parse_args()


def main() -> None:
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
    args = parse_args()
    if args.db != DEFAULT_DB_PATH:
        # Reset taxonomy cache when the CLI overrides the default database.
        load_taxonomy.cache_clear()
        load_taxonomy(args.db)
    parsed = understand_query(args.query)
    print(json.dumps(parsed.to_dict(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
