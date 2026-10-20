from __future__ import annotations

"""Ingredient and life-stage safety filtering on structured product attributes.

Two sources feed one set of constraints:

* the shopper's profile (``UserPreference.safety_flags`` and ``allergens_avoid``),
  e.g. "孕期/备孕/哺乳", "敏感肌", "不碰咖啡因", "纯素";
* exclusions typed in the query that name a structured attribute, e.g. "不要含咖啡因",
  "对坚果过敏" → ``negative_ingredients``.

Products are judged on ``products.attributes_json`` rather than on free text, because
descriptions mention ingredients in both directions ("不含乳制品、大豆" would otherwise
ban the product for 大豆). Products without attributes are left to the text filter.
"""

from dataclasses import dataclass, field
from typing import Any


# Profile flags the web and iOS clients offer, with their user-facing labels.
SAFETY_FLAGS: dict[str, str] = {
    "pregnancy": "孕期/备孕/哺乳期",
    "sensitive_skin": "敏感肌（避开香精和酒精）",
    "no_caffeine": "不碰咖啡因",
    "vegan": "纯素",
}

# Allergens recorded in attributes; profile values must come from this list.
ALLERGENS: tuple[str, ...] = ("乳制品", "大豆", "坚果", "麸质", "鱼")

# Negative query terms that map to a structured attribute instead of a text match.
_NEGATIVE_TO_ALLERGEN = {
    "乳制品": "乳制品", "牛奶": "乳制品", "乳糖": "乳制品", "奶": "乳制品", "乳清": "乳制品",
    "大豆": "大豆", "黄豆": "大豆",
    "坚果": "坚果", "杏仁": "坚果", "花生": "坚果",
    "麸质": "麸质", "小麦": "麸质",
    "鱼": "鱼", "鱼油": "鱼", "海鲜": "鱼",
}
_NEGATIVE_TO_FLAG = {
    "咖啡因": "caffeine", "咖啡": "caffeine",
    "香精": "fragrance", "香料": "fragrance", "香味": "fragrance",
    "酒精": "alcohol", "乙醇": "alcohol",
}


@dataclass
class SafetyConstraints:
    avoid_pregnancy_unsafe: bool = False
    no_caffeine: bool = False
    no_fragrance: bool = False
    no_alcohol: bool = False
    vegan: bool = False
    allergens: set[str] = field(default_factory=set)

    def active(self) -> bool:
        return any(
            (self.avoid_pregnancy_unsafe, self.no_caffeine, self.no_fragrance, self.no_alcohol, self.vegan, self.allergens)
        )

    def labels(self) -> list[str]:
        """Short descriptions for the recommendation summary and composer."""
        out: list[str] = []
        if self.avoid_pregnancy_unsafe:
            out.append("已排除孕期/哺乳期不建议使用的商品")
        if self.no_caffeine:
            out.append("不含咖啡因")
        if self.no_fragrance:
            out.append("无香精")
        if self.no_alcohol:
            out.append("无酒精")
        if self.vegan:
            out.append("纯素")
        if self.allergens:
            out.append("避开过敏原：" + "、".join(sorted(self.allergens)))
        return out


def split_negatives(negatives: list[str]) -> tuple[list[str], SafetyConstraints]:
    """Separate attribute-backed exclusions from the ones left to text matching."""
    constraints = SafetyConstraints()
    remaining: list[str] = []
    for term in negatives:
        if term in _NEGATIVE_TO_ALLERGEN:
            constraints.allergens.add(_NEGATIVE_TO_ALLERGEN[term])
        elif _NEGATIVE_TO_FLAG.get(term) == "caffeine":
            constraints.no_caffeine = True
        elif _NEGATIVE_TO_FLAG.get(term) == "fragrance":
            constraints.no_fragrance = True
        elif _NEGATIVE_TO_FLAG.get(term) == "alcohol":
            constraints.no_alcohol = True
        else:
            remaining.append(term)
    return remaining, constraints


def constraints_from_profile(profile: dict[str, Any] | None, base: SafetyConstraints | None = None) -> SafetyConstraints:
    """Merge the profile's safety flags and allergens into ``base``."""
    out = base or SafetyConstraints()
    if not profile or profile.get("personalization_enabled") is False:
        return out
    flags = set(profile.get("safety_flags") or [])
    out.avoid_pregnancy_unsafe |= "pregnancy" in flags
    out.no_caffeine |= "no_caffeine" in flags
    if "sensitive_skin" in flags:
        out.no_fragrance = True
        out.no_alcohol = True
    out.vegan |= "vegan" in flags
    out.allergens |= {a for a in (profile.get("allergens_avoid") or []) if a in ALLERGENS}
    return out


def violation(attributes: dict[str, Any], c: SafetyConstraints) -> str | None:
    """The first reason a product breaks the constraints, or ``None``."""
    if not attributes:
        return None
    if c.avoid_pregnancy_unsafe and attributes.get("pregnancy") == "avoid":
        return "孕期/哺乳期不建议"
    if c.no_caffeine and attributes.get("caffeine"):
        return "含咖啡因"
    if c.no_fragrance and attributes.get("fragrance"):
        return "含香精"
    if c.no_alcohol and attributes.get("alcohol"):
        return "含酒精"
    if c.vegan and attributes.get("vegan") is False:
        return "含动物来源成分"
    hit = c.allergens & set(attributes.get("allergens") or [])
    if hit:
        return "含过敏原：" + "、".join(sorted(hit))
    return None
