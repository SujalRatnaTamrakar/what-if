"""Tests for the provider fallback chain (§6.1 *_CHAIN) and the OpenAI provider.

All network is mocked — no API keys needed. Run from backend/::

    ../.venv/bin/python -m pytest agents/tests/test_providers_chain.py -q
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from unittest.mock import MagicMock

import httpx
import pytest

from backend.agents.providers import get_provider
from backend.agents.providers.base import LLMProvider
from backend.agents.providers.chain import FallbackProvider
from backend.agents.providers.openai import OpenAIProvider
from backend.common.errors import (
    InvalidProviderOutput,
    ProviderTimeout,
    ProviderUnavailable,
    is_transient_provider_error,
)


class _ScriptedLeg(LLMProvider):
    """Test leg: plays back a script of return values / exceptions."""

    def __init__(self, name, model, script):
        self.name = name
        self.model = model
        self._script = list(script)
        self.calls = 0

    def generate_json(self, system, user, images, schema, timeout):
        self.calls += 1
        action = self._script.pop(0)
        if isinstance(action, Exception):
            raise action
        return action


def _ok():
    return {"ok": True}


# --- transient classification ------------------------------------------------

def test_transient_classification():
    assert is_transient_provider_error(ProviderUnavailable("429"))
    assert is_transient_provider_error(ProviderTimeout("slow"))
    assert not is_transient_provider_error(InvalidProviderOutput("bad json"))
    assert not is_transient_provider_error(ValueError("boom"))
    # RenderFailed is transient only for 404-ish (retired model) failures.
    from backend.common.errors import RenderFailed

    assert is_transient_provider_error(RenderFailed("model 404 not found"))
    assert not is_transient_provider_error(RenderFailed("CUDA OOM"))


# --- chain behavior ----------------------------------------------------------

def test_chain_falls_back_on_429_then_succeeds():
    leg1 = _ScriptedLeg("gemini", "gemini-2.5-flash", [ProviderUnavailable("429")])
    leg2 = _ScriptedLeg("openai", "gpt-4o-mini", [_ok()])
    chain = FallbackProvider(role="scene", legs=[leg1, leg2])
    out = chain.generate_json("s", "u", [], {}, 10)
    assert out == {"ok": True}
    assert leg1.calls == 1 and leg2.calls == 1
    # honest provenance: the winner's identity is stamped on the chain
    assert chain.name == "openai"
    assert chain.model == "gpt-4o-mini"


def test_chain_surfaces_when_all_legs_fail():
    legs = [
        _ScriptedLeg("gemini", "m1", [ProviderUnavailable("429")]),
        _ScriptedLeg("openai", "m2", [ProviderTimeout("slow")]),
    ]
    chain = FallbackProvider(role="review", legs=legs)
    with pytest.raises(ProviderUnavailable) as ei:
        chain.generate_json("s", "u", [], {}, 10)
    msg = str(ei.value)
    assert "gemini" in msg and "openai" in msg  # per-provider errors attached


def test_chain_does_not_fall_back_on_contract_violation():
    leg1 = _ScriptedLeg("gemini", "m1", [InvalidProviderOutput("bad json")])
    leg2 = _ScriptedLeg("openai", "m2", [_ok()])
    chain = FallbackProvider(role="scene", legs=[leg1, leg2])
    with pytest.raises(InvalidProviderOutput):
        chain.generate_json("s", "u", [], {}, 10)
    assert leg2.calls == 0  # never retried on another leg


def test_get_provider_builds_fallback_from_chain_env(monkeypatch):
    monkeypatch.setenv("SCENE_PROVIDER", "fallback")
    monkeypatch.setenv("SCENE_CHAIN", "gemini,openai")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.5-flash")
    p = get_provider("scene")
    assert isinstance(p, FallbackProvider)
    assert [leg.name for leg in p.legs] == ["gemini", "openai"]


def test_get_provider_openai_single(monkeypatch):
    monkeypatch.setenv("DRAFT_PROVIDER", "openai")
    p = get_provider("draft")
    assert isinstance(p, OpenAIProvider)
    assert p.model == os.environ.get("OPENAI_MODEL", "gpt-4o-mini")


# --- OpenAI provider ---------------------------------------------------------

def _fake_openai_client(*, script):
    """Fake openai client: chat.completions.create plays back script items.

    Each item is either a JSON-able dict (returned as message content) or an
    exception to raise.
    """
    client = MagicMock()
    it = iter(script)

    def create(**kwargs):
        item = next(it)
        if isinstance(item, Exception):
            raise item
        msg = MagicMock()
        msg.content = json.dumps(item)
        choice = MagicMock()
        choice.message = msg
        resp = MagicMock()
        resp.choices = [choice]
        return resp

    client.chat.completions.create.side_effect = create
    return client


def _scene_json():
    return {
        "summary": "Bus stop with a bench.",
        "observations": ["bench"],
        "uncertainties": [],
        "preserve": ["sign"],
        "options": [
            {
                "id": "shade_canopy",
                "category": "shade",
                "title": "Canopy",
                "description": "A canopy.",
                "editGoal": "Add a canopy.",
                "maskHint": "Brush above the bench.",
                "requestDraft": "Please add a canopy.",
            }
        ],
        "provider": "openai",
        "model": "gpt-4o-mini",
        "analyzedAt": "2026-10-10T17:00:05Z",
    }


def test_openai_generate_json_ok(monkeypatch, tmp_path):
    img = tmp_path / "s.jpg"
    from PIL import Image

    Image.new("RGB", (64, 64), (10, 20, 30)).save(img)
    p = OpenAIProvider(model="gpt-4o-mini", api_key="test-key")
    monkeypatch.setattr(p, "_client", lambda: _fake_openai_client(script=[_scene_json()]))
    out = p.generate_json("sys", "user", [img], {"type": "object"}, 10)
    assert out["summary"] == "Bus stop with a bench."
    assert out["options"][0]["id"] == "shade_canopy"


def test_openai_repair_retry_then_valid(monkeypatch, tmp_path):
    """Validate/repair path: bad JSON first, corrected JSON on retry."""
    img = tmp_path / "s.jpg"
    from PIL import Image

    Image.new("RGB", (64, 64), (10, 20, 30)).save(img)
    bad = {"summary": "missing everything else"}  # fails Scene validation downstream
    p = OpenAIProvider(model="gpt-4o-mini", api_key="test-key")
    fake_client = _fake_openai_client(script=[bad, _scene_json()])
    monkeypatch.setattr(p, "_client", lambda: fake_client)
    # generate_json itself just parses; the agents._generate_validated layer
    # does the repair. Here we assert the raw second-call plumbing works:
    first = p.generate_json("sys", "user", [img], {"type": "object"}, 10)
    assert first["summary"] == "missing everything else"
    second = p.generate_json("sys", "user", [img], {"type": "object"}, 10)
    assert second["options"][0]["id"] == "shade_canopy"


def _openai_exc(cls, status):
    req = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
    if cls.__name__ == "APITimeoutError":
        return cls("timed out", request=req)
    resp = httpx.Response(status, request=req)
    return cls("boom", response=resp, body=None)


def test_openai_429_maps_to_transient(monkeypatch, tmp_path):
    from openai import RateLimitError

    img = tmp_path / "s.jpg"
    from PIL import Image

    Image.new("RGB", (64, 64), (10, 20, 30)).save(img)
    p = OpenAIProvider(model="gpt-4o-mini", api_key="test-key")
    monkeypatch.setattr(
        p,
        "_client",
        lambda: _fake_openai_client(script=[_openai_exc(RateLimitError, 429)]),
    )
    with pytest.raises(ProviderUnavailable):
        p.generate_json("sys", "user", [img], {"type": "object"}, 10)


def test_openai_400_maps_to_contract_violation_not_transient(monkeypatch, tmp_path):
    from openai import BadRequestError

    img = tmp_path / "s.jpg"
    from PIL import Image

    Image.new("RGB", (64, 64), (10, 20, 30)).save(img)
    p = OpenAIProvider(model="gpt-4o-mini", api_key="test-key")
    monkeypatch.setattr(
        p,
        "_client",
        lambda: _fake_openai_client(script=[_openai_exc(BadRequestError, 400)]),
    )
    with pytest.raises(InvalidProviderOutput) as ei:
        p.generate_json("sys", "user", [img], {"type": "object"}, 10)
    # the mapped error must NOT be transient -> the chain would not retry it
    assert not is_transient_provider_error(ei.value)


def test_openai_missing_key_is_unavailable():
    p = OpenAIProvider(model="gpt-4o-mini", api_key=None)
    # ensure env doesn't secretly provide a key
    import os as _os

    old = _os.environ.pop("OPENAI_API_KEY", None)
    try:
        with pytest.raises(ProviderUnavailable):
            p._client()
    finally:
        if old is not None:
            _os.environ["OPENAI_API_KEY"] = old
