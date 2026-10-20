from __future__ import annotations

"""否定/反选（品类反选结构化 + 归一 + 正则兜底）的单元测试。

覆盖三层防线：
  P0 结构化：where_builder 把 sub_category_exclude / category_exclude 翻成 $nin
  P1 归一：_normalize_negatives 把"棉条/暖宝宝"收敛到"卫生棉条/暖宫贴"
  P2 兜底：LLM 失败降级时 _regex_extract_excludes 从原句抽品类反选
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from search.query_understanding import (
    ParsedQuery,
    _regex_extract_brand_excludes,
    expand_brands,
    _regex_extract_excludes,
    understand_query,
)
from search.where_builder import build_chroma_where
from search.search_service import _normalize_negatives


# --------------------------- P0: structured exclusions in `where` ---------------------------

def test_sub_category_exclude_becomes_nin():
    parsed = ParsedQuery(
        original_query="推荐经期用品 不要卫生棉条",
        category="经期关怀",
        sub_category_exclude=["卫生棉条"],
    )
    where = build_chroma_where(parsed)
    assert where == {
        "$and": [
            {"category": "经期关怀"},
            {"sub_category": {"$nin": ["卫生棉条"]}},
        ]
    }


def test_category_exclude_becomes_nin():
    parsed = ParsedQuery(
        original_query="推荐吃的 不要补剂",
        category_exclude=["女性营养素"],
    )
    where = build_chroma_where(parsed)
    assert where == {"category": {"$nin": ["女性营养素"]}}


def test_brand_exclude_alias_expands_variants():
    parsed = ParsedQuery(
        original_query="非她力非力格的蛋白粉",
        brand_exclude=["她力", "Forma"],
    )
    where = build_chroma_where(parsed)
    excluded = where["brand"]["$nin"]
    assert "她力 HerPower" in excluded
    assert "她力" in excluded
    assert "力格 Forma" in excluded


def test_expand_brands_accepts_alias_variant():
    expanded = expand_brands(["HerPower", "她力"])
    assert "她力 HerPower" in expanded
    assert "她力" in expanded


def test_regex_extracts_compact_brand_excludes():
    excludes = _regex_extract_brand_excludes("非她力非力格的运动补给")
    assert "她力" in excludes
    assert "力格" in excludes


def test_successful_llm_parse_still_merges_regex_brand_excludes(monkeypatch):
    monkeypatch.setattr(
        "search.query_understanding._cached_understand",
        lambda query: ParsedQuery(original_query=query, retrieval_query=query),
    )

    parsed = understand_query("非她力非力格的蛋白粉")

    assert "她力" in parsed.brand_exclude
    assert "力格" in parsed.brand_exclude


def test_multiple_sub_excludes():
    parsed = ParsedQuery(
        original_query="x",
        sub_category="卫生巾",
        sub_category_exclude=["卫生棉条", "月经杯"],
    )
    where = build_chroma_where(parsed)
    assert {"sub_category": "卫生巾"} in where["$and"]
    assert {"sub_category": {"$nin": ["卫生棉条", "月经杯"]}} in where["$and"]


# --------------------------- P1: negative-term normalization ---------------------------

def test_normalize_collapses_synonyms_to_canonical():
    assert _normalize_negatives(["棉条"]) == ["卫生棉条"]
    assert _normalize_negatives(["暖宝宝"]) == ["暖宫贴"]
    assert _normalize_negatives(["乳糖"]) == ["乳制品"]


def test_normalize_dedups():
    # Multiple synonyms should collapse to one normalized value.
    assert _normalize_negatives(["暖宝宝", "暖贴", "暖宫贴"]) == ["暖宫贴"]


def test_normalize_passthrough_non_alias():
    # Non-alias ingredient terms should remain unchanged.
    assert _normalize_negatives(["花生", "抹茶"]) == ["花生", "抹茶"]


def test_normalize_empty_safe():
    assert _normalize_negatives(None) == []
    assert _normalize_negatives([]) == []


# --------------------------- P2: regex fallback after LLM failure ---------------------------

def test_regex_extracts_sub_exclude_with_synonym():
    sub, cat = _regex_extract_excludes("推荐经期用品，不要棉条")
    assert "卫生棉条" in sub
    assert cat == []


def test_regex_extracts_heat_patch_synonym():
    sub, cat = _regex_extract_excludes("经期用品 不要暖宝宝")
    assert "暖宫贴" in sub


def test_regex_does_not_exclude_the_noun_after_de():
    # 「不含酒精的清爽防晒」 asks for sunscreen without alcohol; 防晒 must stay searchable.
    sub, cat = _regex_extract_excludes("给我妈买 300 元以内不含酒精的清爽防晒")
    assert "运动防晒" not in sub
    assert cat == []


def test_regex_keeps_exclusion_after_a_space():
    sub, cat = _regex_extract_excludes("推荐补剂，不要 肌酸")
    assert "肌酸" in sub


def test_regex_zero_false_positive_on_price():
    # A price constraint without a category must not produce a false category exclusion.
    sub, cat = _regex_extract_excludes("推荐蛋白粉，不要太贵")
    assert sub == []
    assert cat == []


def test_regex_no_negation_cue_returns_empty():
    # Return no exclusions when the query has no negative trigger.
    sub, cat = _regex_extract_excludes("推荐电解质")
    assert sub == []
    assert cat == []


# ----------------- P2: fallback exclusions across all categories -----------------

def test_regex_cycle_care_official_and_synonym():
    assert "卫生巾" in _regex_extract_excludes("推荐经期用品，不要卫生巾")[0]
    assert "卫生巾" in _regex_extract_excludes("推荐经期用品，不要姨妈巾")[0]
    assert "经期内裤" in _regex_extract_excludes("推荐经期用品，不要安心裤")[0]


def test_regex_nutrition_synonym():
    assert "铁剂" in _regex_extract_excludes("推荐营养素，不要铁片")[0]
    assert "复合维生素" in _regex_extract_excludes("推荐营养素，不要多维")[0]


def test_regex_apparel_synonym():
    assert "运动内衣" in _regex_extract_excludes("推荐运动服，不要运动bra")[0]
    assert "跑鞋" in _regex_extract_excludes("推荐装备，不要跑步鞋")[0]


def test_regex_recovery_synonym():
    assert "运动防晒" in _regex_extract_excludes("推荐运动护肤，不要防晒霜")[0]
    assert "洁面" in _regex_extract_excludes("推荐运动护肤，不要洗面奶")[0]


def test_regex_no_false_positive_on_plain_request():
    # Never extract a category without both a negative trigger and a category reference.
    assert _regex_extract_excludes("随便推荐点东西") == ([], [])
    assert _regex_extract_excludes("推荐无糖饮品") == ([], [])


# --------------------------- Removing a condition chip ---------------------------

def test_drop_conditions_removes_only_the_named_chips():
    from search.query_understanding import ParsedQuery, drop_conditions

    parsed = ParsedQuery(
        original_query="q",
        sub_category="防晒",
        max_price=300.0,
        negative_ingredients=["酒精"],
        brand_exclude=["某牌"],
        soft_terms=["清爽", "适合妈妈"],
        retrieval_query="清爽防晒 适合妈妈",
    )
    out = drop_conditions(parsed, ["price", "soft:适合妈妈"])
    assert out.max_price is None
    assert out.sub_category == "防晒"
    assert out.negative_ingredients == ["酒精"]
    assert out.brand_exclude == ["某牌"]
    assert out.soft_terms == ["清爽"]
    assert out.retrieval_query == "清爽防晒"


def test_drop_conditions_scrubs_the_wording_from_retrieval_text():
    from search.query_understanding import ParsedQuery, drop_conditions

    parsed = ParsedQuery(
        original_query="q",
        sub_category="防晒",
        max_price=300.0,
        negative_ingredients=["酒精"],
        retrieval_query="300元以内不含酒精的清爽防晒霜（适合妈妈使用）",
    )
    assert "300" not in drop_conditions(parsed, ["price"]).retrieval_query
    assert "酒精" not in drop_conditions(parsed, ["neg:酒精"]).retrieval_query
    assert "300元以内" in drop_conditions(parsed, ["neg:酒精"]).retrieval_query
