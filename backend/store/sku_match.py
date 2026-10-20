from __future__ import annotations

"""Pick SKU options that fit the shopper's body profile (size, bra size, shoe size, shade).

The chat cart tool uses this to preselect options in its spec card; the web client
mirrors the same rules in web/src/lib/skuMatch.ts for product pages.
"""

import re
from typing import Any

# skin_tone values stored in UserPreference.body_profile → words that mark a fitting shade.
_TONE_WORDS = {
    "cool": ("冷",),
    "neutral": ("自然",),
    "warm": ("暖", "小麦", "健康"),
}


def _shoe_fits(value: str, shoe: str) -> bool:
    if not shoe.isdigit():
        return False
    size = int(shoe)
    span = re.fullmatch(r"(\d{2})\s*-\s*(\d{2})", value.strip())
    if span:
        return int(span.group(1)) <= size <= int(span.group(2))
    return value.strip() == shoe


def suggest_option(dimension: str, values: list[str], profile: dict[str, Any]) -> str | None:
    """The value of one SKU dimension that matches the profile, if exactly one does."""
    body = profile.get("body_profile") or {}
    if not body:
        return None
    matches: list[str] = []
    if "码" in dimension:
        clothing = str(body.get("clothing_size") or "").upper()
        bra = str(body.get("bra_size") or "").upper()
        shoe = str(body.get("shoe_size") or "")
        for value in values:
            head = value.split("（")[0].strip().upper()
            if bra and head == bra:
                matches.append(value)
            elif clothing and head == clothing:
                matches.append(value)
            elif shoe and _shoe_fits(head, shoe):
                matches.append(value)
    elif "色号" in dimension:
        words = _TONE_WORDS.get(str(body.get("skin_tone") or ""), ())
        matches = [v for v in values if any(w in v for w in words)]
    return matches[0] if len(matches) == 1 else None


def suggest_options(dimensions: dict[str, list[str]], profile: dict[str, Any] | None) -> dict[str, str]:
    """``{dimension: value}`` for every dimension the profile decides."""
    if not profile or profile.get("personalization_enabled") is False:
        return {}
    out: dict[str, str] = {}
    for dimension, values in dimensions.items():
        choice = suggest_option(dimension, values, profile)
        if choice:
            out[dimension] = choice
    return out
