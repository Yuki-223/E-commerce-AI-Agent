from __future__ import annotations

"""ClarifyTool：用户 query 太模糊时，引导用户补充信息。

Phase 1 用模板话术，不调 LLM：响应快、零成本、可控。
后续 Phase 可换成 LLM 生成更自然的澄清问句（结合品类/历史偏好）。
"""

from typing import Any

from agent.session import AgentSession
from agent.tools.base import ToolResult


_CLARIFY_TEXT = (
    "为了帮你更精准地推荐，可以补充一下：\n"
    "1. 想看哪个品类的补给？（运动营养 / 女性营养素 / 经期关怀 / 运动服饰 / 运动修护 / 功能轻食）\n"
    "2. 预算大概多少？\n"
    "3. 场景或需求？（例如：经期训练、备孕、马拉松、敏感肌、不碰咖啡因 等）"
)


class ClarifyTool:
    name: str = "clarify"

    def run(
        self,
        query: str,
        session: AgentSession,
        slots: dict[str, Any],
    ) -> ToolResult:
        return ToolResult(
            tool_name=self.name,
            payload={"query": query, "reason": "query too vague"},
            narrative_override=_CLARIFY_TEXT,
            needs_composer=False,
        )
