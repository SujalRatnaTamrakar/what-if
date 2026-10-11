import os
from unittest import mock

import pytest
from PIL import Image

import agents
from agents import policy
from agents.providers import GeminiProvider
from agents.schemas import EditPromptOut, ModerationOut, ReviewOut
from common.errors import ProviderUnavailable

FAKE = {"PROMPT_PROVIDER": "fake", "MODERATION_PROVIDER": "fake", "REVIEW_PROVIDER": "fake"}
GEMINI = {"PROMPT_PROVIDER": "gemini", "MODERATION_PROVIDER": "gemini", "REVIEW_PROVIDER": "gemini",
          "GEMINI_API_KEY": "test-key", "GEMINI_MODEL": "test-model"}


@pytest.fixture
def images(tmp_path):
    src = tmp_path / "src.jpg"
    concept = tmp_path / "concept.png"
    mask = tmp_path / "mask.png"
    Image.new("RGB", (64, 48), (100, 100, 100)).save(src)
    Image.new("RGB", (64, 48), (100, 100, 100)).save(concept)
    m = Image.new("L", (64, 48), 0)
    m.paste(255, (16, 12, 40, 30))
    m.save(mask)
    return src, concept, mask


@pytest.mark.parametrize("text,allowed", [
    ("This bus stop needs a roof/shed", True),
    ("remove graffiti from the wall", True),
    ("shoot a photo of new trees", True),
    ("add a gun to the bench", False),
    ("put a nazi flag here", False),
])
def test_keyword_check(text, allowed):
    assert policy.keyword_check(text).allowed is allowed


@mock.patch.dict(os.environ, FAKE)
def test_fake_providers_full_chain(images):
    src, concept, mask = images
    assert agents.moderate_prompt(src, "add a roof").allowed
    ep = agents.build_edit_prompt(src, mask, "add a roof")
    assert ep.positive.startswith("photorealistic") and "people" in ep.negative
    review = agents.review_concept(src, concept, mask, "add a roof")
    dumped = review.model_dump(by_alias=True, mode="json")
    assert set(dumped) == {"verdict", "flags", "outsideMaskChange", "provider", "model", "reviewedAt"}
    assert dumped["verdict"] == "needs_review" and dumped["outsideMaskChange"] == 0.0
    assert agents.suggest_title("add a roof", "Ponce Ave").startswith("What if")


@mock.patch.dict(os.environ, GEMINI)
def test_gemini_review_maps_flags_and_verdict(images):
    src, concept, mask = images
    out = ReviewOut(flags=[{"code": "PEOPLE_ADDED", "severity": "warning", "message": "A person appeared."},
                           {"code": "IMPLAUSIBLE_STRUCTURE", "severity": "warning", "message": "It is safe."},
                           {"code": "MADE_UP", "severity": "warning", "message": "x"}])
    with mock.patch.object(GeminiProvider, "generate_json", return_value=out):
        review = agents.review_concept(src, concept, mask, "add a roof")
    codes = [(f.code, f.severity) for f in review.flags]
    assert codes == [("PEOPLE_ADDED", "blocking"), ("IMPLAUSIBLE_STRUCTURE", "warning")]
    assert review.verdict == "blocked"
    assert "safe" not in review.flags[1].message
    assert [f.id for f in review.flags] == ["f1", "f2"]


@mock.patch.dict(os.environ, GEMINI)
def test_review_provider_down_returns_review_unavailable(images):
    src, concept, mask = images
    with mock.patch.object(GeminiProvider, "generate_json", side_effect=ProviderUnavailable("down")):
        review = agents.review_concept(src, concept, mask, "add a roof")
    assert review.verdict == "needs_review"
    assert review.flags[-1].code == "REVIEW_UNAVAILABLE"


@mock.patch.dict(os.environ, GEMINI)
def test_moderation_falls_back_to_keywords_when_provider_down(images):
    src, _, _ = images
    with mock.patch.object(GeminiProvider, "generate_json", side_effect=ProviderUnavailable("down")):
        assert agents.moderate_prompt(src, "add a roof").allowed
        assert not agents.moderate_prompt(src, "add a bomb").allowed


@mock.patch.dict(os.environ, GEMINI)
def test_gemini_moderation_and_edit_prompt(images):
    src, _, mask = images
    with mock.patch.object(GeminiProvider, "generate_json", return_value=ModerationOut(
            allowed=False, reason="Not a place improvement.", categories=["harassment"])):
        result = agents.moderate_prompt(src, "make my neighbor look ugly")
    assert not result.allowed and result.reason
    with mock.patch.object(GeminiProvider, "generate_json", return_value=EditPromptOut(
            edit_goal="Add a metal roof over the bench", positive="photorealistic metal bus shelter roof",
            negative="blurry", preserve=["road"])):
        ep = agents.build_edit_prompt(src, mask, "needs a roof")
    assert ep.edit_goal == "Add a metal roof over the bench"
    assert all(t in ep.negative for t in ("text", "watermark", "people"))


@mock.patch.dict(os.environ, {**GEMINI, "GEMINI_API_KEY": ""})
def test_build_edit_prompt_without_key_raises(images):
    src, _, mask = images
    with pytest.raises(ProviderUnavailable):
        agents.build_edit_prompt(src, mask, "needs a roof")


@mock.patch.dict(os.environ, {**GEMINI, "GEMINI_API_KEY": ""})
def test_title_falls_back_when_provider_down():
    assert agents.suggest_title("needs a roof", "Ponce Ave") == "What if Ponce Ave: needs a roof"
