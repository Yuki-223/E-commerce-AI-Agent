from __future__ import annotations

"""LLM query understanding through function-calling structured extraction.

Taxonomy enums come from SQLite, preventing invented categories or brands. The model
handles aliases and negative language contextually. Failures and timeouts fall back to
the rule-based parser in ``query_understanding.py``.
"""

import json
from typing import Any

from llm.client import get_client, get_model_id
from search.query_understanding import (
    BRAND_ALIASES,
    INGREDIENT_BLOCKLIST,
    ParsedQuery,
    load_taxonomy,
)


def _variant_to_canonical(taxonomy: dict) -> dict[str, str]:
    """Reverse variant-to-canonical index used as a defensive brand fallback."""
    aliases = {**(taxonomy.get("aliases") or {}), **BRAND_ALIASES}
    return {variant: canonical for canonical, variants in aliases.items() for variant in variants}


# ---------------------------------------------------------------------------
# 1. Function schema
# ---------------------------------------------------------------------------

def _build_tool_schema(taxonomy: dict) -> dict:
    """Build a function-calling schema from the current SQLite taxonomy.

    Category and brand enums constrain model output to real catalog values.
    """
    sub_categories = sorted(taxonomy["sub_to_cat"].keys())
    categories = sorted({c for c in taxonomy["sub_to_cat"].values() if c})
    brands = list(taxonomy["brands"])

    return {
        "type": "function",
        "function": {
            "name": "extract_search_intent",
            "description": "从用户的中文电商查询中抽取结构化检索意图。",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": ["string", "null"],
                        "enum": [*categories, None],
                        "description": "用户想要的一级品类，必须严格选自候选列表；用户只给出大类（如\"美妆\"）时填这里，无法判断填 null。",
                    },
                    "sub_category": {
                        "type": ["string", "null"],
                        "enum": [*sub_categories, None],
                        "description": "用户想要的子类目，必须严格选自候选列表；无法判断时填 null。",
                    },
                    "brand_include": {
                        "type": "array",
                        "items": {"type": "string", "enum": brands},
                        "description": "用户明确表达想要的品牌，注意区分否定语境。",
                    },
                    "brand_exclude": {
                        "type": "array",
                        "items": {"type": "string", "enum": brands},
                        "description": "用户明确排除的品牌。'不要 X' 这种否定才放进来。",
                    },
                    "category_exclude": {
                        "type": "array",
                        "items": {"type": "string", "enum": categories},
                        "description": (
                            "用户明确排除的【一级品类】，必须严格选自候选列表。"
                            "用户说'不要X品类'时把官方品类名放进来。"
                        ),
                    },
                    "sub_category_exclude": {
                        "type": "array",
                        "items": {"type": "string", "enum": sub_categories},
                        "description": (
                            "用户明确排除的【子类目】，必须严格选自候选列表（不是字面词！）。"
                            "这是品类反选的首选字段——用户说'不要功能性饮料'/'不要能量饮料'，"
                            "都要映射到官方子类目 '功能饮料' 放进来，而不是塞进 negative_ingredients。"
                        ),
                    },
                    "max_price": {
                        "type": ["number", "null"],
                        "description": "价格上限（人民币元）。如 '300 以内' → 300。",
                    },
                    "min_price": {
                        "type": ["number", "null"],
                        "description": "价格下限。如 '200 到 500' → 200。",
                    },
                    "negative_ingredients": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": (
                            "用户明确要排除的成分 / 品类 / 属性的【字面词】，下游在商品全文里做子串剔除。"
                            "必须填商品文本里会真实出现的词，例如 "
                            + "、".join(INGREDIENT_BLOCKLIST)
                            + " 等；也可以是这些之外的任意词（如 '花生'、'抹茶'、'辣'）。"
                        ),
                    },
                    "soft_terms": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "主观偏好与场景词，如 '经期'、'马拉松'、'温和'、'性价比'。用于召回后重排，不做硬过滤。",
                    },
                    "needs_clarification": {
                        "type": "boolean",
                        "description": "query 过于模糊（如'随便看看'）无法检索时为 true。",
                    },
                },
                "required": [
                    "category",
                    "sub_category",
                    "brand_include",
                    "brand_exclude",
                    "category_exclude",
                    "sub_category_exclude",
                    "max_price",
                    "min_price",
                    "negative_ingredients",
                    "soft_terms",
                    "needs_clarification",
                ],
                "additionalProperties": False,
            },
        },
    }


SYSTEM_PROMPT = """你是女性补给平台的搜索需求解析器。平台的一级品类：运动营养、女性营养素、经期关怀、运动服饰、运动修护、功能轻食。严格遵守以下规则：

1. 你必须调用 extract_search_intent 函数，不要直接回答用户。
2. category / sub_category / brand 必须严格从 enum 候选中选，禁止编造或写中文翻译。
3. 否定语义只看局部范围：
   - "我要她力的，不要太贵" → brand_include=["她力 HerPower"]，brand_exclude=[]
   - "推荐蛋白粉，不要力格" → sub_category="蛋白粉"，brand_exclude=["力格 Forma"]
4. 【品类反选优先走结构化字段，这是最重要的反选规则】：
   用户说"不要X品类"/"不要X类的"/"除了X"时，先判断 X 是不是一个品类/子类目：
   - 是子类目 → 放进 sub_category_exclude（映射到官方值），**不要**放进 negative_ingredients。
     例："推荐经期用品，不要卫生棉条" → sub_category_exclude=["卫生棉条"]
     例："推荐补剂，不要肌酸" → sub_category_exclude=["肌酸"]
   - 是一级品类 → 放进 category_exclude（映射到官方值）。
     例："推荐点吃的，不要补剂" → category_exclude=["女性营养素"]
   子类目/品类的同义说法必须归一到 enum 官方值。
5. negative_ingredients 只用于【非品类的成分 / 口味 / 属性】排除（品类反选已由上一条处理）：
   用户说"不含X"/"无X"/"不要X的"/"对X过敏"且 X 不是品类时填。务必填【字面词】：
   - "不要咖啡因" / "无咖啡因" → ["咖啡因"]
   - "对坚果过敏" → ["坚果"]；"乳糖不耐" / "不要乳制品" → ["乳制品"]
   - "不要大豆" → ["大豆"]；"无麸质" → ["麸质"]；"不吃鱼" → ["鱼"]
   - "无香精" / "不要香味" → ["香精"]；"不含酒精" → ["酒精"]；"无糖" → ["糖"]
   注意：不要把用户正在搜索的主体品类填进来，只填要排除的部分。
6. 一级品类（category）同义词映射（用户只给大类、没给子品类时务必填 category）：
   - "蛋白"/"补剂"/"运动补给"/"健身补充" → "运动营养"
   - "维生素"/"营养素"/"补铁"/"补钙"/"叶酸"/"保健品" → "女性营养素"
   - "大姨妈"/"例假"/"月经"/"经期用品"/"生理期" → "经期关怀"
   - "运动服"/"运动装"/"瑜伽服"/"运动穿搭" → "运动服饰"
   - "运动护肤"/"运动后护理"/"个护" → "运动修护"
   - "吃的"/"零食"/"饮品"/"早餐"/"轻食" → "功能轻食"
7. 子品类（sub_category）同义词要映射到官方值：
   - "乳清"/"增肌粉" → "蛋白粉"；"电解质水"/"盐丸" → "电解质"
   - "铁片"/"补铁" → "铁剂"；"钙片"/"维D" → "钙与维生素D"；"多维" → "复合维生素"
   - "姨妈巾" → "卫生巾"；"棉条" → "卫生棉条"；"安心裤"/"月经裤" → "经期内裤"；"暖宝宝"/"暖贴" → "暖宫贴"
   - "运动bra"/"运动文胸" → "运动内衣"；"跑步鞋" → "跑鞋"；"防晒衣"/"皮肤衣" → "防晒外套"
   - "防晒霜"/"防晒乳" → "运动防晒"；"素颜霜"/"隔离" → "防晒隔离"；"洗面奶" → "洁面"
   - 若用户说的子品类在 enum 里找不到对应官方值，宁可只填 category、把 sub_category 留 null，
     也不要硬套一个语义不符的子类。
8. 周期与人群信息（"经期"、"黄体期"、"孕期"、"备孕"、"马拉松"）属于场景，放进 soft_terms，不要放进 negative_ingredients。
9. needs_clarification 只在 query 完全没有任何商品线索时才设为 true（如"随便看看"、"你好"）；
   只要识别到 category / sub_category / brand / 价格 / 偏好 / 场景中任意一项，就设为 false。
10. 数字提取要小心：
   - "300 以内" → max_price=300
   - "200 到 500" → min_price=200, max_price=500
   - "25g 蛋白"、"500mg 钠" 不是价格
11. 不确定的字段填 null 或空数组，不要瞎猜。
"""


# ---------------------------------------------------------------------------
# 2. Public entry point
# ---------------------------------------------------------------------------

def parse_query_with_llm(
    query: str,
    timeout: float = 6.0,
) -> ParsedQuery:
    """Extract intent through the configured function-calling model.

    Failures are raised so the orchestration layer can select a rule-based fallback.
    """
    taxonomy = load_taxonomy()
    tool = _build_tool_schema(taxonomy)

    client = get_client()
    response = client.chat.completions.create(
        model=get_model_id(),
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": query},
        ],
        tools=[tool],
        tool_choice={"type": "function", "function": {"name": "extract_search_intent"}},
        temperature=0.1,
        timeout=timeout,
    )

    arguments = _extract_tool_arguments(response)
    return _to_parsed_query(query, arguments, taxonomy)


def _extract_tool_arguments(response: Any) -> dict[str, Any]:
    """Extract the argument dictionary from a function-calling response."""
    message = response.choices[0].message
    if not message.tool_calls:
        raise ValueError("LLM 没有调用 extract_search_intent，原始响应：" + str(message))
    raw = message.tool_calls[0].function.arguments
    return _loads_arguments(raw)


def _loads_arguments(raw: str) -> dict[str, Any]:
    """Parse function arguments with recovery for known malformed outputs.

    Recovery handles code fences, surrounding prose, leaked ``<parameter>`` tags,
    protocol markers, and truncated brackets. Only complete recovery failure is raised
    to the caller.
    """
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    text = raw.strip()
    if text.startswith("```"):
        # Remove a JSON code fence while retaining its content.
        text = text.split("```", 2)[1] if text.count("```") >= 2 else text.strip("`")
        if text.lstrip().lower().startswith("json"):
            text = text.lstrip()[4:]

    start = text.find("{")
    end = text.rfind("}")
    candidate = text[start : end + 1] if start != -1 and end != -1 and end > start else text
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        # Repair leaked parameter tags and retry with the first JSON object.
        repaired = _repair_param_leak(candidate)
        r_start = repaired.find("{")
        r_end = repaired.rfind("}")
        if r_start != -1 and r_end != -1 and r_end > r_start:
            repaired = repaired[r_start : r_end + 1]
        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            # Strip leaked protocol markers, balance truncated brackets, and parse again.
            return json.loads(_strip_tool_noise_and_balance(text))


def _balance_brackets(text: str) -> str:
    """Complete missing closing brackets in truncated JSON.

    String literals and escapes are skipped while a stack tracks unmatched braces.
    """
    stack: list[str] = []
    in_str = False
    esc = False
    for ch in text:
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch in "{[":
            stack.append(ch)
        elif ch in "}]" and stack:
            stack.pop()
    closers = "".join("}" if c == "{" else "]" for c in reversed(stack))
    return text + closers


def _strip_tool_noise_and_balance(text: str) -> str:
    """Strip leaked tool-call protocol markers and balance truncated JSON.

    Starting at the first object brace, remove the first XML-like marker and everything
    after it, then append any missing closing brackets.
    """
    import re

    start = text.find("{")
    if start == -1:
        return text
    body = text[start:]
    # Remove the first leaked XML/protocol marker and everything after it.
    match = re.search(r"<\s*/?\s*[A-Za-z][\w:.-]*[^>]*>", body)
    if match:
        body = body[: match.start()]
    return _balance_brackets(body.rstrip())


def _repair_param_leak(text: str) -> str:
    """Repair internal ``<parameter>`` tags leaked into JSON arguments.

    Remove opening prefixes, normalize tagged values into key-value pairs, remove closing
    tags, and restore commas lost between adjacent keys.
    """
    if "parameter" not in text:
        return text

    import re

    text = text.replace("<parameter name=", "")

    def _normalize_value(val: str) -> str:
        val = val.strip()
        if val in ("null", "true", "false"):
            return val
        if re.fullmatch(r"-?\d+(\.\d+)?", val):
            return val
        return '"' + val.replace('"', "") + '"'

    text = re.sub(
        r'("[A-Za-z_]+")\s+string="[^"]*">([^<]*)</parameter>',
        lambda m: f"{m.group(1)}: {_normalize_value(m.group(2))}",
        text,
    )
    text = text.replace("</parameter>", "")
    # Restore a comma when one completed value is followed by the next key.
    text = re.sub(r'("|\]|\d|null|true|false)\s*\n\s*(")', r"\1, \2", text)
    return text


# Meaningful single-character flavor terms are exempt from the noise guard.
_SHORT_NEGATIVE_ALLOW: frozenset[str] = frozenset({"辣", "甜", "咸", "酸", "苦"})


def _clean_negatives(values: list[str] | None) -> list[str]:
    """Normalize arbitrary negative terms extracted by the LLM.

    Trim, remove empties, and deduplicate in order. Single-character noise is dropped
    unless it belongs to a known ingredient or meaningful flavor allowlist.
    """
    if not values:
        return []
    seen: set[str] = set()
    out: list[str] = []
    for raw in values:
        term = (raw or "").strip()
        if not term or term in seen:
            continue
        if len(term) < 2 and term not in INGREDIENT_BLOCKLIST and term not in _SHORT_NEGATIVE_ALLOW:
            continue
        seen.add(term)
        out.append(term)
    return out


def _to_parsed_query(
    query: str,
    arguments: dict[str, Any],
    taxonomy: dict,
) -> ParsedQuery:
    """Wrap extracted arguments in ``ParsedQuery`` with final taxonomy validation.

    Unknown categories or brands are discarded defensively even though schema enums
    should already prevent them.
    """
    sub_category = arguments.get("sub_category")
    if sub_category and sub_category not in taxonomy["sub_to_cat"]:
        sub_category = None

    # Derive the parent category from subcategory, or use the model category when absent.
    known_categories = {c for c in taxonomy["sub_to_cat"].values() if c}
    if sub_category:
        category = taxonomy["sub_to_cat"].get(sub_category)
    else:
        category = arguments.get("category")
        if category not in known_categories:
            category = None

    known_brands = set(taxonomy["brands"])
    variant_index = _variant_to_canonical(taxonomy)

    def _filter_brands(values: list[str] | None) -> list[str]:
        """Map variants to canonical brands, deduplicate, and drop unknown values."""
        if not values:
            return []
        seen: set[str] = set()
        out: list[str] = []
        for value in values:
            canonical = variant_index.get(value, value)
            if canonical in known_brands and canonical not in seen:
                seen.add(canonical)
                out.append(canonical)
        return out

    known_sub_categories = set(taxonomy["sub_to_cat"].keys())

    def _filter_enum(values: list[str] | None, allowed: set[str]) -> list[str]:
        """Retain unique category exclusions present in the taxonomy enum."""
        if not values:
            return []
        seen: set[str] = set()
        out: list[str] = []
        for value in values:
            if value in allowed and value not in seen:
                seen.add(value)
                out.append(value)
        return out

    return ParsedQuery(
        original_query=query,
        intent="product_search",
        category=category,
        sub_category=sub_category,
        category_exclude=_filter_enum(arguments.get("category_exclude"), known_categories),
        sub_category_exclude=_filter_enum(arguments.get("sub_category_exclude"), known_sub_categories),
        max_price=_coerce_float(arguments.get("max_price")),
        min_price=_coerce_float(arguments.get("min_price")),
        brand_include=_filter_brands(arguments.get("brand_include")),
        brand_exclude=_filter_brands(arguments.get("brand_exclude")),
        negative_ingredients=_clean_negatives(arguments.get("negative_ingredients")),
        soft_terms=list(arguments.get("soft_terms") or []),
        retrieval_query=query,  # Preserve raw text; soft terms are used during reranking.
        # Any product signal makes the query searchable; final clarification belongs to
        # the context-aware agent router.
        needs_clarification=bool(arguments.get("needs_clarification", False)) and not _has_any_signal(
            category=category,
            sub_category=sub_category,
            max_price=arguments.get("max_price"),
            min_price=arguments.get("min_price"),
            brand_include=arguments.get("brand_include"),
            soft_terms=arguments.get("soft_terms"),
        ),
    )


def _has_any_signal(**fields: Any) -> bool:
    """Return whether any structured field contains a searchable signal."""
    for value in fields.values():
        if value in (None, "", [], ()):
            continue
        return True
    return False


def _coerce_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
