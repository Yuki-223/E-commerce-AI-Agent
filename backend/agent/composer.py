from __future__ import annotations

"""AnswerComposer：把 ToolResult 转成自然语言回答。

提供两种入口：
    - compose():        一次性返回完整 narrative（保留给后端测试 / 内部脚本）
    - compose_stream(): 流式生成器，逐 chunk yield 文本片段（SSE / CLI 用）

为什么独立成模块（而不是塞进 tool 里）：
    - tool 关心"做了什么"（payload），composer 关心"怎么说出来"。
      分开后可以无侵入地换风格（专业 / 活泼 / 简洁）。
    - 流式输出只需改 composer，tool 完全不动。
    - 复用：将来 compare / detail_qa tool 也走同一个 composer。
"""

import json
import logging
from collections.abc import Iterator
from typing import Any

from agent.session import AgentSession
from agent.tools.base import ToolResult
from llm.client import get_client, get_model_id


logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """你是 CartPilot 的女性补给顾问：熟悉女性运动、营养和经期周期的常识，说话像懂行又贴心的朋友，而不是念商品参数的机器人。

风格要求：
- 中文回答，简洁自然，避免冗长，控制在 200 字以内。
- 直接基于提供的 payload 中的真实商品信息说话，绝不编造任何不存在的字段或商品。
- 必须返回 JSON 格式，包含以下字段：
  - "opening": 开场白，用"为你XXX了"的格式（如"为你挑了几款经期也能放心用的补给"）
    - "items": 数组，每个元素包含 {"productId": "...", "description": "..."}，**productId 必须原样使用 payload.hits 里对应商品的 productId，禁止自造序号**；每个商品必须对应一个专属解说词，不能多个商品共用一段描述；description 写 1-2 句、约 30 个中文字符（25-40 字之间），先点核心卖点再补适用场景或人群，内容要具体充实、不要写成很短的套话，**绝不能包含商品名、品牌名、型号或价格**。
  - "followup": 数组，包含 3-5 条【用户视角】的可直接发送 Prompt。每条都是用户亲口对导购说的话，点击后会填入输入框供编辑发送。
    - 正确："推荐其他支撑强度的运动内衣"、"看看无咖啡因的"、"找孕期也能用的"、"推荐其他品牌的蛋白粉"
    - 错误（禁止）："需要其他支撑强度的运动内衣？"、"想要无咖啡因的吗？"、"要不要看看其他品牌？" —— 这是助手在问用户，不是用户在提需求
    - 用祈使/请求口吻（推荐/找/看看/对比/帮我…），禁止"要不要""需要吗""想要吗"等问句；结合当前推荐写具体可执行的下一步，不要空泛
- 卡片本身已经展示价格；除非 opening 里做总体价格梯度说明，否则不要在 items[].description 里重复价格。
- 介绍每款时落到使用场景和人群（通勤、学习、送礼…），而不是只报价格和参数；每款写 1-2 句、约 30 字，先说卖点再补适合谁/什么场景，不要写保养建议、注意事项或长段参数说明。
- 适度点出关键差异帮用户决策（价格梯度、核心卖点、适合谁）。
- 若 payload.hits 为空，坦诚告知未找到，并给出具体的放宽建议（提高预算到 X、放宽品牌等）。此时 opening 说明未找到，items 为空数组。
- 若 payload 里有 groups（用户一次提了多个需求，如"衣服和防晒"），请【按组分段】介绍：每组先点明需求（如"防晒方面"、"衣服方面"），再说该组挑了哪几款、为什么适合，不要把不同需求的商品混在一起说。
- 若 payload.safety 非空，opening 里用半句话说明已按这些条件筛过（如"已避开咖啡因和坚果"），让用户放心。
- 涉及孕期、经期、补铁补钙等健康话题时，只描述商品本身的用途和适合人群，不做疗效承诺；需要时提醒"具体用量请听医生或营养师的建议"。
- 不要复述 JSON 字段名，用自然口语介绍。
- JSON 格式必须严格正确，不要包含任何额外文字；输出首字符必须是 {，末字符必须是 }。"""


PRODUCT_DETAIL_SYSTEM_PROMPT = """你是一位专业的单品导购问答助手。用户已经指向了某一款商品，你的任务是基于 payload.product 和 payload.evidence 回答用户追问。

严格规则：
- 只输出自然中文，不要输出 JSON。
- 回答控制在 3-5 句，直接回应用户问点。
- 必须基于 payload.evidence 和 payload.product，不要编造没有证据的信息。
- 如果 payload.focus_aspect 是 reviews 或 negative_reviews，必须严格分成 3 个独立段落，每段单独一行，不要额外加开场或结尾。
- 评价类回答要简洁但有信息量：每段写 1-2 句，每段不超过 70 个中文字符；优点和缺点各总结 2-3 个核心点，不要写成大段流水账。
    ✨ 总结：概括整体口碑，可补一句适合谁/整体倾向。
    🌟 优点：总结最明显的 2-3 个好处；没有足够证据就说“正向信息不多”。
    🔍 缺点：总结最明显的 2-3 个顾虑；没有足够证据就说“未见集中差评”。
- 如果 payload.focus_aspect 是 general 或 performance，用户是在了解产品本身：只输出 1 个自然段，不要分点、不要换行、不要 emoji，控制在 90 个中文字符以内。
- 通用/性能类回答要像导购简短介绍：包含产品定位、1-2 个核心卖点，以及适合人群或购买前注意点；禁止写成长段参数介绍。
- 注意区分用户意图：general/performance 是了解产品本身，用单段简介；reviews/negative_reviews 是看评价口碑，用“优点/缺点”三段。
- 如果用户问评价/口碑，优先总结 user_review 证据里的共性，兼顾正负两面。
- 如果用户问差评/缺点，仍保持“总结/优点/缺点”三段式，但缺点段必须优先说明负面证据；如果负面证据不足，要明确说目前证据有限。
- 如果用户问敏感肌、孕期哺乳期、经期、成分安全或补充剂用量，不要做医疗承诺，只能说“从商品说明和FAQ看”，并建议遵医嘱；payload.product.attributes 里的成分和安全标记可以直接引用。
- 评价类回答不要逐条引用用户原话；只有非评价类追问才可适度引用一两条证据来源，例如“有用户提到…”。
- 证据不足时要坦诚，不要硬夸。"""


# Few-shot conversations demonstrate the desired shopping-assistant voice. Product and
# price values in these examples are fictional formatting examples, not response data.
_FEW_SHOT: list[dict[str, str]] = [
    {
        "role": "user",
        "content": (
            'tool: recommend\n'
            'payload: {"query": "长跑补给，不要咖啡因", "parsed": {"category": "运动营养", "negative_ingredients": ["咖啡因"]}, '
            '"safety": ["不含咖啡因"], '
            '"hits": [{"productId": "p_demo_001", "title": "示例 电解质冲剂 高钠无糖", "price": 79}, '
            '{"productId": "p_demo_002", "title": "示例 能量胶 百香果无咖啡因", "price": 96}, '
            '{"productId": "p_demo_003", "title": "示例 100%椰子水", "price": 79}]}'
        ),
    },
    {
        "role": "assistant",
        "content": (
            '{"opening": "为你挑了 3 款长跑补给，都已避开咖啡因", '
            '"items": ['
            '{"productId": "p_demo_001", "description": "高钠配方补回大量出汗流失的盐分，夏天长距离和热瑜伽后不容易乏力"}, '
            '{"productId": "p_demo_002", "description": "双碳水快速供能，跑步超过一小时按间隔补一支，后半程更稳"}, '
            '{"productId": "p_demo_003", "description": "天然含钾口感清甜，适合轻松跑和日常训练后的补水"}'
            '], '
            '"followup": ["推荐适合经期训练的补给", "对比一下电解质冲剂和椰子水", "推荐训练后的蛋白粉"]}'
        ),
    },
    {
        "role": "user",
        "content": (
            'tool: recommend\n'
            'payload: {"query": "100元以内的胶原蛋白", "parsed": {"sub_category": "胶原蛋白", "max_price": 100}, '
            '"hits": []}\n'
            'hint: no_hits'
        ),
    },
    {
        "role": "assistant",
        "content": (
            '{"opening": "抱歉，100元以内暂时没有合适的胶原蛋白", '
            '"items": [], '
            '"followup": ["预算放宽到200以内再推荐", "推荐富含维C的日常补给", "推荐运动后关节养护的商品"]}'
        ),
    },
    {
        "role": "user",
        "content": (
            'tool: recommend\n'
            'payload: {"query": "经期补铁", "parsed": {"category": "女性营养素"}, '
            '"hits": [{"productId": "p_demo_004", "title": "示例 甘氨酸亚铁+维生素C", "brand": "示例", "sub_category": "铁剂"}]}'
        ),
    },
    {
        "role": "assistant",
        "content": (
            '{"opening": "为你找到一款温和补铁的营养素", '
            '"items": ['
            '{"productId": "p_demo_004", "description": "甘氨酸亚铁对肠胃更温和，搭配维C帮助吸收，适合月经量多又爱运动的你"}'
            '], '
            '"followup": ["补铁期间能喝什么茶", "推荐富含铁的零食", "对比一下复合维生素和铁剂"]}'
        ),
    },
]


# Drop payload fields the LLM does not need, such as evidence chunks, to save tokens.
_HIT_KEEP_KEYS = ("title", "brand", "category", "sub_category", "price_display", "price", "base_price", "score")


def _trim_hit_for_llm(h: dict[str, Any]) -> dict[str, Any]:
    """Keep narrative fields and normalize ``product_id`` to ``productId``."""
    out: dict[str, Any] = {}
    pid = h.get("product_id") or h.get("productId")
    if pid:
        out["productId"] = pid
    for k in _HIT_KEEP_KEYS:
        if k in h:
            out[k] = h[k]
    return out


def _trim_payload_for_llm(payload: dict[str, Any]) -> dict[str, Any]:
    trimmed: dict[str, Any] = {
        "query": payload.get("query"),
    }
    if payload.get("product"):
        trimmed["product"] = payload.get("product")
    if payload.get("focus_aspect"):
        trimmed["focus_aspect"] = payload.get("focus_aspect")
    if payload.get("evidence"):
        trimmed["evidence"] = payload.get("evidence")
    contextual = payload.get("contextual_search")
    if isinstance(contextual, dict):
        trimmed["contextual_search"] = {
            k: contextual.get(k)
            for k in (
                "mode", "target_query", "target_terms", "target_sub_categories",
                "anchor_query", "anchor_sub_category", "exclude_sub_categories", "relation",
            )
            if contextual.get(k)
        }
    # Parsed intent now lives under debug; retain compatibility with the old top level.
    parsed = (payload.get("debug") or {}).get("parsed") or payload.get("parsed") or {}
    trimmed["parsed"] = {
        k: parsed.get(k)
        for k in ("category", "sub_category", "max_price", "min_price", "brand_include", "brand_exclude", "negative_ingredients")
        if parsed.get(k)
    }
    safety = (payload.get("summary") or {}).get("safety")
    if safety:
        trimmed["safety"] = safety
    # Product lists use ``products`` in the new format and ``hits`` in the old format.
    hits = payload.get("products") or payload.get("hits") or []
    trimmed["hits"] = [_trim_hit_for_llm(h) for h in hits]
    # Preserve compact demand groups so the composer can organize multi-need responses.
    groups = payload.get("groups")
    if isinstance(groups, list):
        trimmed_groups = []
        for g in groups:
            g_products = g.get("products") or []
            if not g_products:
                continue
            trimmed_groups.append(
                {
                    "label": g.get("label"),
                    "hits": [_trim_hit_for_llm(h) for h in g_products],
                }
            )
        if trimmed_groups:
            trimmed["groups"] = trimmed_groups
    return trimmed


def _build_messages(tool_result: ToolResult) -> list[dict[str, str]]:
    trimmed = _trim_payload_for_llm(tool_result.payload)
    user_msg_parts = [
        f"tool: {tool_result.tool_name}",
        f"payload: {json.dumps(trimmed, ensure_ascii=False)}",
    ]
    if tool_result.composer_hint:
        user_msg_parts.append(f"hint: {tool_result.composer_hint}")
    system_prompt = (
        PRODUCT_DETAIL_SYSTEM_PROMPT
        if tool_result.tool_name == "product_detail"
        else SYSTEM_PROMPT
    )
    few_shot = [] if tool_result.tool_name == "product_detail" else _FEW_SHOT
    return [
        {"role": "system", "content": system_prompt},
        *few_shot,
        {"role": "user", "content": "\n".join(user_msg_parts)},
    ]


def _extract_json_object(text: str) -> str | None:
    """Extract the first balanced JSON object, tolerating model preface/trailing text."""
    start: int | None = None
    depth = 0
    in_string = False
    escaped = False

    for index, char in enumerate(text):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            if depth == 0:
                start = index
            depth += 1
        elif char == "}" and depth > 0:
            depth -= 1
            if depth == 0 and start is not None:
                candidate = text[start:index + 1]
                try:
                    json.loads(candidate)
                except json.JSONDecodeError:
                    return None
                return candidate
    return None


def _normalize_json_response(text: str) -> str:
    stripped = (text or "").strip()
    return _extract_json_object(stripped) or stripped


def _fallback_json_response(tool_result: ToolResult) -> str:
    payload = tool_result.payload or {}
    if tool_result.tool_name == "product_detail":
        product = payload.get("product") or {}
        title = product.get("title") or "这款商品"
        evidence_note = "现有证据有限，"
        return f"{evidence_note}{title}可以先参考商品描述、问答和用户评价再判断；如果你想看评价、差评或使用建议，可以继续具体问我。"

    hits = payload.get("products") or payload.get("hits") or []
    items = []
    for hit in hits[:5]:
        product_id = hit.get("product_id") or hit.get("productId") or ""
        title = hit.get("title") or "这款商品"
        if not product_id:
            continue
        items.append(
            {
                "productId": product_id,
                "description": f"{title}整体匹配你的需求，可以先点开详情看看。",
            }
        )

    if items:
        opening = f"为你找到 {len(items)} 款可以优先看的商品"
        followup = ["推荐一些更平价的选择", "看看更多同类商品", "对比一下刚才推荐的两款"]
    else:
        opening = "暂时没有生成完整说明，可以换个说法再试一次"
        followup = ["预算放宽一些再推荐", "换个品牌看看", "重新帮我推荐"]
    return json.dumps(
        {"opening": opening, "items": items, "followup": followup},
        ensure_ascii=False,
    )


class AnswerComposer:
    def compose(
        self,
        tool_result: ToolResult,
        session: AgentSession,
        timeout: float = 10.0,
    ) -> str:
        """Block until the LLM returns a complete response."""
        if tool_result.narrative_override is not None:
            return tool_result.narrative_override
        if not tool_result.needs_composer:
            return ""

        client = get_client()
        response = client.chat.completions.create(
            model=get_model_id(),
            messages=_build_messages(tool_result),
            temperature=0.4,
            timeout=timeout,
        )
        return _normalize_json_response(response.choices[0].message.content or "")

    def compose_stream(
        self,
        tool_result: ToolResult,
        session: AgentSession,
        timeout: float = 30.0,
    ) -> Iterator[str]:
        """Yield streamed text chunks.

        A narrative override is emitted as one chunk so callers need no special case.
        Stream failures preserve emitted content and append a fallback message instead
        of raising, preventing clients from hanging on a partial response.
        """
        if tool_result.narrative_override is not None:
            yield tool_result.narrative_override
            return
        if not tool_result.needs_composer:
            return

        client = get_client()
        try:
            stream = client.chat.completions.create(
                model=get_model_id(),
                messages=_build_messages(tool_result),
                temperature=0.4,
                timeout=timeout,
                stream=True,
            )
            pieces: list[str] = []
            for chunk in stream:
                # OpenAI-compatible clients expose streamed delta content here.
                try:
                    delta = chunk.choices[0].delta
                except (AttributeError, IndexError):
                    continue
                piece = getattr(delta, "content", None)
                if piece:
                    pieces.append(piece)
            if pieces:
                yield _normalize_json_response("".join(pieces))
            else:
                # Provide a fallback if the model emits no content.
                yield _fallback_json_response(tool_result)
        except Exception as exc:  # noqa: BLE001 - streaming must contain every failure
            logger.exception("Streaming compose failed mid-flight")
            yield _fallback_json_response(tool_result)
