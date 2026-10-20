"""Safety filtering on structured attributes (search/safety.py) inside SearchService."""

from __future__ import annotations

from search.query_understanding import ParsedQuery
from search.safety import SafetyConstraints, constraints_from_profile, split_negatives, violation
from search.search_service import SearchService
from rag.retriever import RetrievedChunk

ATTRS = {
    "whey": {"allergens": ["乳制品"], "pregnancy": "caution", "caffeine": False, "fragrance": False, "alcohol": False, "vegan": False},
    "plant": {"allergens": [], "pregnancy": "safe", "caffeine": True, "fragrance": False, "alcohol": False, "vegan": True},
    "creatine": {"allergens": [], "pregnancy": "avoid", "caffeine": False, "fragrance": False, "alcohol": False, "vegan": True},
    "legacy": {},
}


def _chunk(pid: str, distance: float, document: str = "") -> RetrievedChunk:
    return RetrievedChunk(
        chunk_id=f"{pid}-chunk",
        document=document or f"{pid} 运动补给",
        metadata={"product_id": pid, "title": pid, "brand": "b", "category": "运动营养", "sub_category": "蛋白粉", "base_price": 100},
        distance=distance,
    )


class _Retriever:
    def __init__(self, chunks):
        self.chunks = chunks

    def search(self, query, top_k=10, where=None):
        return list(self.chunks)


class _Products:
    def get_attributes(self, product_ids):
        return {pid: ATTRS[pid] for pid in product_ids if pid in ATTRS}


def _search(parsed: ParsedQuery, profile=None, chunks=None):
    service = SearchService(
        retriever=_Retriever(chunks or [_chunk(p, 0.1 * i) for i, p in enumerate(ATTRS, 1)]),
        reranker=None,
        use_rerank=False,
        use_hybrid=False,
        product_store=_Products(),
    )
    return service.search(parsed.original_query, parsed=parsed, user_profile=profile)


def test_split_negatives_routes_attribute_terms():
    remaining, c = split_negatives(["咖啡因", "坚果", "乳糖", "抹茶"])
    assert remaining == ["抹茶"]
    assert c.no_caffeine and {"坚果", "乳制品"} <= c.allergens


def test_profile_flags_merge_and_respect_personalization_switch():
    profile = {"safety_flags": ["pregnancy", "sensitive_skin"], "allergens_avoid": ["鱼", "不存在"]}
    c = constraints_from_profile(profile)
    assert c.avoid_pregnancy_unsafe and c.no_fragrance and c.no_alcohol
    assert c.allergens == {"鱼"}
    assert not constraints_from_profile({**profile, "personalization_enabled": False}).active()


def test_violation_reasons():
    assert violation(ATTRS["creatine"], SafetyConstraints(avoid_pregnancy_unsafe=True)) == "孕期/哺乳期不建议"
    assert violation(ATTRS["whey"], SafetyConstraints(allergens={"乳制品"})) == "含过敏原：乳制品"
    assert violation(ATTRS["legacy"], SafetyConstraints(no_caffeine=True)) is None


def test_pregnancy_profile_drops_unsafe_products():
    result = _search(ParsedQuery(original_query="蛋白补给"), profile={"safety_flags": ["pregnancy"]})
    pids = [h.product_id for h in result.hits]
    assert "creatine" not in pids
    assert {"whey", "plant", "legacy"} <= set(pids)
    assert result.safety_excluded == {"creatine": "孕期/哺乳期不建议"}
    assert result.safety == ["已排除孕期/哺乳期不建议使用的商品"]


def test_query_exclusions_use_attributes_not_text():
    # The plant protein's copy says "不含乳制品、大豆"; text matching on 大豆 would wrongly drop it.
    chunks = [_chunk("plant", 0.1, "不含乳制品、大豆和麸质的植物蛋白"), _chunk("whey", 0.2)]
    parsed = ParsedQuery(original_query="不要乳制品和大豆", negative_ingredients=["乳制品", "大豆"])
    pids = [h.product_id for h in _search(parsed, chunks=chunks).hits]
    assert pids == ["plant"]


def test_no_constraints_leaves_results_untouched():
    result = _search(ParsedQuery(original_query="蛋白补给"))
    assert len(result.hits) == 4
    assert result.safety == []
