from __future__ import annotations

"""Context-aware retrieval plans for multi-turn shopping conversations.

An ordinary refinement keeps filtering within the previous category, but requests
such as “搭配一件上衣” or “再看看运动鞋” change the current target. The previous
category should then provide context only, not a retrieval term or hard filter.

This module provides a lightweight deterministic first stage. A small taxonomy and
alias table identifies complement and category-pivot requests and emits a search plan.
"""

from dataclasses import dataclass, field
from typing import Any, Literal

from search.query_understanding import ParsedQuery


SearchMode = Literal["complement", "pivot"]


@dataclass(frozen=True)
class ContextualSearchPlan:
    """Structured plan for a cross-category or complementary follow-up."""

    mode: SearchMode
    target_query: str
    target_terms: list[str]
    target_sub_categories: list[str] = field(default_factory=list)
    anchor_query: str | None = None
    anchor_sub_category: str | None = None
    exclude_sub_categories: list[str] = field(default_factory=list)
    relation: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "target_query": self.target_query,
            "target_terms": self.target_terms,
            "target_sub_categories": self.target_sub_categories,
            "anchor_query": self.anchor_query,
            "anchor_sub_category": self.anchor_sub_category,
            "exclude_sub_categories": self.exclude_sub_categories,
            "relation": self.relation,
        }


# Natural-language aliases mapped to one or more catalog subcategories.
_TARGET_ALIASES: dict[str, list[str]] = {
    # 运动服饰
    "运动内衣": ["运动内衣"],
    "内衣": ["运动内衣"],
    "瑜伽裤": ["瑜伽裤"],
    "裤子": ["瑜伽裤", "骑行短裤"],
    "跑鞋": ["跑鞋"],
    "鞋": ["跑鞋"],
    "背心": ["运动背心"],
    "上衣": ["运动背心", "防晒外套"],
    "防晒衣": ["防晒外套"],
    "外套": ["防晒外套"],
    "骑行裤": ["骑行短裤"],
    "袜子": ["运动袜"],
    # 运动营养
    "蛋白粉": ["蛋白粉"],
    "蛋白棒": ["蛋白棒"],
    "电解质": ["电解质"],
    "能量胶": ["能量胶"],
    "肌酸": ["肌酸"],
    "胶原蛋白": ["胶原蛋白"],
    # 女性营养素
    "铁剂": ["铁剂"],
    "补铁": ["铁剂"],
    "叶酸": ["叶酸"],
    "钙片": ["钙与维生素D"],
    "镁": ["镁"],
    "鱼油": ["鱼油"],
    "维生素": ["复合维生素", "维生素B12"],
    "益生菌": ["益生菌"],
    # 经期关怀
    "卫生巾": ["卫生巾"],
    "棉条": ["卫生棉条"],
    "月经杯": ["月经杯"],
    "安心裤": ["经期内裤"],
    "暖宫贴": ["暖宫贴"],
    "暖贴": ["暖宫贴"],
    "姜茶": ["经期茶饮"],
    # 运动修护
    "防晒": ["运动防晒", "防晒隔离"],
    "止汗": ["止汗露"],
    "洗面奶": ["洁面"],
    "身体乳": ["身体乳"],
    "唇膏": ["润唇膏"],
    "发带": ["发圈发带"],
    # 功能轻食
    "燕麦": ["燕麦"],
    "坚果": ["坚果"],
    "零食": ["坚果", "巧克力"],
    "巧克力": ["巧克力"],
    "酸奶": ["酸奶"],
    "茶": ["饮品"],
    "饮料": ["饮品"],
    "椰子水": ["饮品"],
}


_COMPLEMENT_WORDS = (
    "搭配", "配套", "配什么", "一起买", "一起搭", "适合配", "配一件",
    "配个", "搭一件", "搭个", "搭一套", "穿搭",
)

_PIVOT_WORDS = (
    "看看", "看一下", "看下", "再看", "再看看", "换成", "换个",
    "换一类", "其他品类", "别的品类", "其他类", "另一个品类",
)


def detect_contextual_plan(
    query: str,
    base: ParsedQuery | None,
) -> ContextualSearchPlan | None:
    """Detect complement or category-pivot follow-ups.

    Return ``None`` to continue through the regular recommend/refine path. A plan is
    returned only when the current target is recognized and differs from the prior
    subcategory.
    """
    text = (query or "").strip()
    if not text:
        return None

    target = _find_target_term(text, base)
    if target is None:
        return None

    target_term, target_subs = target
    anchor_sub = base.sub_category if base else None
    anchor_query = (base.retrieval_query or base.original_query) if base else None
    exclude_subs = [anchor_sub] if anchor_sub and anchor_sub not in target_subs else []

    if _has_any(text, _COMPLEMENT_WORDS):
        return ContextualSearchPlan(
            mode="complement",
            target_query=target_term,
            target_terms=[target_term],
            target_sub_categories=target_subs,
            anchor_query=anchor_query,
            anchor_sub_category=anchor_sub,
            exclude_sub_categories=exclude_subs,
            relation="搭配",
        )

    # A new target under an existing context usually means a category pivot. Trigger
    # words reduce false positives; short inputs such as "sports top" also count.
    if base is not None and (_has_any(text, _PIVOT_WORDS) or _is_short_target_only(text, target_term)):
        return ContextualSearchPlan(
            mode="pivot",
            target_query=target_term,
            target_terms=[target_term],
            target_sub_categories=target_subs,
            anchor_query=anchor_query,
            anchor_sub_category=anchor_sub,
            exclude_sub_categories=exclude_subs,
            relation="换目标品类",
        )

    return None


def _find_target_term(
    text: str,
    base: ParsedQuery | None,
) -> tuple[str, list[str]] | None:
    """Find the longest target alias, excluding the previous subcategory."""
    anchor_sub = base.sub_category if base else None
    for term in sorted(_TARGET_ALIASES, key=len, reverse=True):
        if term not in text:
            continue
        subs = _TARGET_ALIASES[term]
        if anchor_sub and subs == [anchor_sub]:
            continue
        return term, subs
    return None


def _has_any(text: str, words: tuple[str, ...]) -> bool:
    return any(word in text for word in words)


def _is_short_target_only(text: str, target_term: str) -> bool:
    compact = text.replace(" ", "")
    return compact == target_term or (target_term in compact and len(compact) <= len(target_term) + 4)
