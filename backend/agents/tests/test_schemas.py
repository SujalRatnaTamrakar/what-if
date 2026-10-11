"""Unit tests for the agents module (§10.6 step 1).

Expected JSON is written inline from the §5.3 examples in the master plan.
Run from the repo root:
    .venv/bin/python -m pytest backend/agents/tests -v
"""
import json
from pathlib import Path

import pytest
from PIL import Image
from pydantic import ValidationError

from backend.agents import (
    analyze_scene,
    build_edit_prompt,
    draft_request,
    review_concept,
)
from backend.agents.catalog import CATALOG
from backend.agents.schemas import (
    EditPrompt,
    Option,
    RequestDraft,
    Review,
    Scene,
)

# --- §5.3 example shapes, written inline ------------------------------------

OPTION_JSON = {
    "id": "shade_canopy",
    "category": "shade",
    "title": "Freestanding shade canopy over the bench",
    "description": "A slim steel-post canopy covering the existing bench area.",
    "editGoal": "Add a freestanding shade canopy above the bench; keep sidewalk, sign and road unchanged.",
    "maskHint": "Brush the area above and around the bench.",
    "requestDraft": "Please consider installing a shade canopy at this bus stop...",
}

SCENE_JSON = {
    "summary": "Bus stop with a bench and no overhead cover on a sunny sidewalk.",
    "observations": ["Bench without overhead cover", "Wide sidewalk behind bench"],
    "uncertainties": [
        {"id": "u1", "question": "Is the area behind the bench public right-of-way?"}
    ],
    "preserve": ["bus stop sign", "road markings", "storefronts"],
    "options": [OPTION_JSON],
    "provider": "ollama",
    "model": "qwen2.5vl:7b",
    "analyzedAt": "2026-10-10T17:00:05Z",
}

REVIEW_JSON = {
    "verdict": "needs_review",
    "flags": [
        {
            "id": "f1",
            "code": "IMPLAUSIBLE_STRUCTURE",
            "severity": "warning",
            "message": "Canopy posts appear to float above the pavement.",
        }
    ],
    "outsideMaskChange": 0.012,
    "provider": "gemini",
    "model": "gemini-x",
    "reviewedAt": "2026-10-10T17:01:10Z",
}

DRAFT_JSON = {
    "title": "Shade canopy for the Ponce & Highland bus stop",
    "changeRequest": "Please consider installing a shade canopy at this bus stop...",
}


def test_option_wire_shape():
    opt = Option.model_validate(OPTION_JSON)
    assert opt.model_dump(by_alias=True, mode="json") == OPTION_JSON


def test_scene_wire_shape():
    scene = Scene.model_validate(SCENE_JSON)
    assert scene.model_dump(by_alias=True, mode="json") == SCENE_JSON


def test_review_wire_shape():
    review = Review.model_validate(REVIEW_JSON)
    assert review.model_dump(by_alias=True, mode="json") == REVIEW_JSON


def test_request_draft_wire_shape():
    draft = RequestDraft.model_validate(DRAFT_JSON)
    assert draft.model_dump(by_alias=True, mode="json") == DRAFT_JSON


def test_edit_prompt_wire_shape():
    ep = EditPrompt(
        positive="photorealistic x",
        negative="text",
        preserve=["sign"],
        edit_goal="Add x.",
    )
    assert ep.model_dump(by_alias=True, mode="json") == {
        "positive": "photorealistic x",
        "negative": "text",
        "preserve": ["sign"],
        "editGoal": "Add x.",
    }


def test_scene_rejects_too_many_options():
    bad = dict(SCENE_JSON, options=[OPTION_JSON, OPTION_JSON, OPTION_JSON])
    with pytest.raises(ValidationError):
        Scene.model_validate(bad)


def test_review_rejects_out_of_range_change():
    bad = dict(REVIEW_JSON, outsideMaskChange=1.5)
    with pytest.raises(ValidationError):
        Review.model_validate(bad)


def test_draft_rejects_long_title():
    with pytest.raises(ValidationError):
        RequestDraft.model_validate({"title": "x" * 121, "changeRequest": "ok"})


def test_catalog_ids():
    assert set(CATALOG) == {"shade"}
    assert [e["id"] for e in CATALOG["shade"]] == [
        "user_request",
        "shade_canopy",
        "shade_tree",
        "shade_sail",
    ]


# --- end-to-end with the fake provider --------------------------------------


def _make_image(path: Path, size=(640, 480), color=(120, 140, 160)):
    Image.new("RGB", size, color).save(path, "JPEG")


@pytest.fixture()
def demo_images(tmp_path, monkeypatch):
    monkeypatch.setenv("SCENE_PROVIDER", "fake")
    monkeypatch.setenv("DRAFT_PROVIDER", "fake")
    monkeypatch.setenv("REVIEW_PROVIDER", "fake")
    src = tmp_path / "source.jpg"
    concept = tmp_path / "concept.jpg"
    mask = tmp_path / "mask.png"
    _make_image(src)
    _make_image(concept, color=(130, 140, 160))
    Image.new("L", (640, 480), 0).save(mask, "PNG")
    return src, concept, mask


def test_fake_analyze_scene(demo_images):
    src, _, _ = demo_images
    scene = analyze_scene(src, "No shade.", "Test stop")
    assert isinstance(scene, Scene)
    assert 1 <= len(scene.options) <= 2
    assert scene.provider == "fake"
    valid = {e["id"] for e in CATALOG["shade"]}
    assert all(o.id in valid for o in scene.options)
    # wire format round-trip
    wire = scene.model_dump(by_alias=True, mode="json")
    assert json.loads(json.dumps(wire)) == wire
    assert set(wire) == {
        "summary", "observations", "uncertainties", "preserve",
        "options", "provider", "model", "analyzedAt",
    }


def test_build_edit_prompt_template(demo_images):
    src, _, _ = demo_images
    scene = analyze_scene(src, "No shade.", "Test stop")
    option = scene.options[0]
    ep = build_edit_prompt(scene, option, "No shade.")
    assert isinstance(ep, EditPrompt)
    assert "photorealistic" in ep.positive
    assert "text, watermark, people" in ep.negative
    assert ep.preserve == scene.preserve
    assert ep.edit_goal == option.edit_goal


def test_fake_review_concept(demo_images):
    src, concept, mask = demo_images
    scene = analyze_scene(src, "No shade.", "Test stop")
    review = review_concept(src, concept, mask, scene.options[0], "Please add shade.")
    assert isinstance(review, Review)
    assert review.verdict in ("clear", "needs_review", "blocked")
    assert review.provider == "fake"
    assert all(f.id == f"f{i+1}" for i, f in enumerate(review.flags))
    wire = review.model_dump(by_alias=True, mode="json")
    assert set(wire) == {
        "verdict", "flags", "outsideMaskChange",
        "provider", "model", "reviewedAt",
    }


def test_fake_draft_request(demo_images):
    src, concept, mask = demo_images
    scene = analyze_scene(src, "No shade.", "Test stop")
    review = review_concept(src, concept, mask, scene.options[0], "Please add shade.")
    draft = draft_request(scene, scene.options[0], review, "Test stop", "No shade.")
    assert isinstance(draft, RequestDraft)
    assert len(draft.title) <= 120
    assert len(draft.change_request) <= 1500
