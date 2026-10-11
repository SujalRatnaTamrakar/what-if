"""Tests for the render fallback chain (RENDER_PROVIDER=fallback / RENDER_CHAIN)
and the OpenAI image-edit provider. No network, no API keys.

Run from backend/::

    ../.venv/bin/python -m pytest imaging/tests/test_chain.py -q
"""
from __future__ import annotations

import base64
import io
import os
import tempfile
from pathlib import Path

import httpx
import pytest
from PIL import Image, ImageDraw

os.environ["RENDER_PROVIDER"] = "fake"  # default; individual tests override

from backend.common.errors import (
    InvalidProviderOutput,
    ProviderTimeout,
    ProviderUnavailable,
    RenderFailed,
)
from imaging import get_render_provider, render_edit
from imaging import EditPrompt
from imaging.providers import openai_image


def make_triple(size=(320, 240)):
    w, h = size
    src = Image.new("RGB", size, (90, 120, 160))
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rectangle([w // 4, h // 4, 3 * w // 4, 3 * h // 4], fill=255)
    d = tempfile.mkdtemp(prefix="whatif_chain_test_")
    sp, mp = Path(d) / "src.png", Path(d) / "mask.png"
    src.save(sp)
    mask.save(mp)
    return sp, mp


def _prompt():
    return EditPrompt(
        positive="photorealistic test edit",
        negative="",
        preserve=[],
        editGoal="test edit",
    )


# --- render fallback chain ---------------------------------------------------

def test_fallback_first_leg_429_falls_to_fake(monkeypatch):
    monkeypatch.setenv("RENDER_PROVIDER", "fallback")
    monkeypatch.setenv("RENDER_CHAIN", "openai_image,fake")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    def boom(*a, **k):
        raise ProviderUnavailable("OpenAI rate limited (429)")

    monkeypatch.setattr(openai_image, "render_at_work_size", boom)
    sp, mp = make_triple()
    res = render_edit(sp, mp, _prompt(), seed=7)
    assert res.provider == "fake"  # honest: the leg that actually rendered
    assert Image.open(res.output_path).size == Image.open(sp).size


def test_fallback_404_retired_model_is_transient(monkeypatch):
    monkeypatch.setenv("RENDER_PROVIDER", "fallback")
    monkeypatch.setenv("RENDER_CHAIN", "openai_image,fake")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    def retired(*a, **k):
        raise RenderFailed("OpenAI image model not found (404, retired?)")

    monkeypatch.setattr(openai_image, "render_at_work_size", retired)
    sp, mp = make_triple()
    res = render_edit(sp, mp, _prompt(), seed=7)
    assert res.provider == "fake"


def test_fallback_all_fail_surfaces_unavailable(monkeypatch):
    monkeypatch.setenv("RENDER_PROVIDER", "fallback")
    monkeypatch.setenv("RENDER_CHAIN", "openai_image,comfyui")

    def boom(*a, **k):
        raise ProviderUnavailable("down")

    monkeypatch.setattr(openai_image, "render_at_work_size", boom)
    import imaging.providers.comfyui as comfyui_mod

    monkeypatch.setattr(comfyui_mod, "render_at_work_size", boom)
    sp, mp = make_triple()
    with pytest.raises(ProviderUnavailable) as ei:
        render_edit(sp, mp, _prompt(), seed=7)
    assert "openai_image" in str(ei.value) and "comfyui" in str(ei.value)


def test_fallback_does_not_retry_contract_violation(monkeypatch):
    monkeypatch.setenv("RENDER_PROVIDER", "fallback")
    monkeypatch.setenv("RENDER_CHAIN", "openai_image,fake")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    calls = []

    def bad_output(*a, **k):
        calls.append(1)
        raise InvalidProviderOutput("OpenAI returned no image data")

    def fake_render(*a, **k):
        calls.append("fake")
        from imaging.providers import fake as fake_mod

        return fake_mod.render_at_work_size(*a, **k)

    monkeypatch.setattr(openai_image, "render_at_work_size", bad_output)
    import imaging.providers.fake as fake_mod

    monkeypatch.setattr(fake_mod, "render_at_work_size", fake_render)
    sp, mp = make_triple()
    with pytest.raises(InvalidProviderOutput):
        render_edit(sp, mp, _prompt(), seed=7)
    assert calls == [1]  # fake leg never ran


def test_get_render_provider_fallback_value(monkeypatch):
    monkeypatch.setenv("RENDER_PROVIDER", "fallback")
    assert get_render_provider() == "fallback"


# --- openai_image provider unit ----------------------------------------------

def _b64_png(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


class _Resp:
    def __init__(self, status_code, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self):
        return self._payload


def test_openai_image_renders_and_returns_model(monkeypatch, tmp_path):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_IMAGE_MODEL", "gpt-image-1")
    edited = Image.new("RGB", (64, 64), (200, 100, 50))

    def fake_post(url, **kwargs):
        assert "images/edits" in url
        assert kwargs["headers"]["Authorization"] == "Bearer test-key"
        assert kwargs["data"]["model"] == "gpt-image-1"
        files = kwargs["files"]
        assert set(files) == {"image", "mask"}
        return _Resp(200, {"data": [{"b64_json": _b64_png(edited)}]})

    monkeypatch.setattr(httpx, "post", fake_post)
    sp = tmp_path / "src.png"
    mp = tmp_path / "mask.png"
    Image.new("RGB", (64, 64), (10, 20, 30)).save(sp)
    Image.new("L", (64, 64), 0).save(mp)
    img, model = openai_image.render_at_work_size(sp, mp, _prompt(), seed=1, timeout_s=30)
    assert model == "gpt-image-1"
    assert img.size == (64, 64)
    assert img.getpixel((0, 0)) == (200, 100, 50)


def test_openai_image_429_is_transient(monkeypatch, tmp_path):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    def fake_post(url, **kwargs):
        return _Resp(429, text="rate limit")

    monkeypatch.setattr(httpx, "post", fake_post)
    sp = tmp_path / "src.png"
    mp = tmp_path / "mask.png"
    Image.new("RGB", (32, 32)).save(sp)
    Image.new("L", (32, 32), 0).save(mp)
    with pytest.raises(ProviderUnavailable):
        openai_image.render_at_work_size(sp, mp, _prompt(), seed=1, timeout_s=30)


def test_openai_image_missing_key(monkeypatch, tmp_path):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    sp = tmp_path / "src.png"
    mp = tmp_path / "mask.png"
    Image.new("RGB", (32, 32)).save(sp)
    Image.new("L", (32, 32), 0).save(mp)
    with pytest.raises(ProviderUnavailable):
        openai_image.render_at_work_size(sp, mp, _prompt(), seed=1, timeout_s=30)


def test_openai_mask_convention_transparent_where_edit(tmp_path):
    """Our L-mask (255 = edit) becomes transparent (alpha 0) for OpenAI."""
    mp = tmp_path / "mask.png"
    m = Image.new("L", (16, 16), 0)
    ImageDraw.Draw(m).rectangle([4, 4, 11, 11], fill=255)
    m.save(mp)
    raw = openai_image._openai_mask(mp, (16, 16))
    rgba = Image.open(io.BytesIO(raw))
    assert rgba.mode == "RGBA"
    assert rgba.getpixel((8, 8))[3] == 0  # edit region -> transparent
    assert rgba.getpixel((0, 0))[3] == 255  # keep region -> opaque
