from __future__ import annotations

from store.sku_match import suggest_options


def _profile(**body):
    return {"body_profile": body}


def test_clothing_bra_and_shoe_sizes():
    assert suggest_options({"尺码": ["S", "M", "L"]}, _profile(clothing_size="m")) == {"尺码": "M"}
    assert suggest_options({"尺码": ["70B", "75B", "75C"]}, _profile(bra_size="75B", clothing_size="M")) == {"尺码": "75B"}
    assert suggest_options({"尺码": ["35-37", "38-40"]}, _profile(shoe_size="38")) == {"尺码": "38-40"}
    assert suggest_options({"尺码": ["36", "37", "38"]}, _profile(shoe_size="37")) == {"尺码": "37"}


def test_shade_by_skin_tone():
    shades = ["01 象牙白（冷白皮）", "02 自然色（黄一白/自然）", "03 小麦色（黄二白/健康）"]
    assert suggest_options({"色号": shades}, _profile(skin_tone="cool")) == {"色号": shades[0]}
    assert suggest_options({"色号": shades}, _profile(skin_tone="warm")) == {"色号": shades[2]}
    lips = ["透明", "豆沙粉（冷调）", "蜜桃橘（暖调）"]
    assert suggest_options({"色号": lips}, _profile(skin_tone="neutral")) == {}


def test_no_profile_or_personalization_off():
    assert suggest_options({"尺码": ["S", "M"]}, None) == {}
    assert suggest_options({"尺码": ["S", "M"]}, {"personalization_enabled": False, "body_profile": {"clothing_size": "M"}}) == {}
    assert suggest_options({"颜色": ["黑", "白"]}, _profile(clothing_size="M")) == {}
