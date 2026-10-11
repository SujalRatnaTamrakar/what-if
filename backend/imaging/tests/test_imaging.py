"""No GPU or network needed. Run from backend/:  pytest imaging/tests"""
import io
import json
from pathlib import Path

import numpy as np
import pytest
from PIL import Image, ImageDraw

from imaging import outside_mask_change, render_edit
from imaging._errors import ProviderTimeout, ProviderUnavailable, RenderFailed
from imaging.composite import composite

PROMPT = {"positive": "roof", "negative": "text", "preserve": [], "editGoal": "roof"}


@pytest.fixture()
def triple(tmp_path):
    src = Image.new("RGB", (300, 400), (90, 140, 200))
    ImageDraw.Draw(src).rectangle([0, 250, 300, 400], fill=(100, 100, 100))
    mask = Image.new("L", (300, 400), 0)
    ImageDraw.Draw(mask).rectangle([80, 100, 220, 200], fill=255)
    sp, mp = tmp_path / "s.jpg", tmp_path / "m.png"
    src.save(sp, quality=95); mask.save(mp)
    return sp, mp


def test_composite_keeps_unmasked_pixels_identical():
    src = Image.new("RGB", (64, 64), (10, 20, 30))
    edit = Image.new("RGB", (64, 64), (250, 0, 0))
    soft = Image.new("L", (64, 64), 0)
    ImageDraw.Draw(soft).rectangle([20, 20, 40, 40], fill=255)
    out = np.asarray(composite(src, edit, soft))
    assert (out[:10] == np.asarray(src)[:10]).all()
    assert tuple(out[30, 30]) == (250, 0, 0)


def test_fake_render_same_size_and_labeled(triple, monkeypatch):
    monkeypatch.setenv("RENDER_PROVIDER", "fake"); monkeypatch.setenv("RENDER_WORK_EDGE", "128")
    r = render_edit(*triple, PROMPT)
    assert (r.width, r.height) == (300, 400) and r.provider == "fake" and r.workflow_version == "fake_v1"
    assert outside_mask_change(triple[0], r.output_path, triple[1]) < 0.01


def test_mask_size_mismatch(triple, tmp_path, monkeypatch):
    monkeypatch.setenv("RENDER_PROVIDER", "fake")
    bad = tmp_path / "bad.png"; Image.new("L", (10, 10), 0).save(bad)
    with pytest.raises(RenderFailed, match="mask size mismatch"):
        render_edit(triple[0], bad, PROMPT)


def test_outside_mask_change_detects_edits_outside(triple, tmp_path):
    src = Image.open(triple[0]).convert("RGB")
    bad = src.copy(); ImageDraw.Draw(bad).rectangle([0, 300, 300, 400], fill=(255, 255, 255))
    p = tmp_path / "bad_concept.png"; bad.save(p)
    assert outside_mask_change(triple[0], p, triple[1]) > 0.03


# ---- ComfyUI with a mocked HTTP layer ----
class Resp:
    def __init__(self, js=None, content=b"", ok=True, status=200):
        self._js, self.content, self.ok, self.status_code, self.text = js, content, ok, status, json.dumps(js)
    def json(self): return self._js


def png_bytes():
    b = io.BytesIO(); Image.new("RGB", (64, 64), (1, 2, 3)).save(b, "PNG"); return b.getvalue()


def fake_comfy(history, calls):
    def handler(method, url, **kw):
        path = url.split("8188", 1)[1]
        calls.append((method, path))
        if path == "/upload/image": return Resp({"name": "up.png"})
        if path == "/prompt": return Resp({"prompt_id": "P1"})
        if path.startswith("/history"): return Resp(history)
        if path == "/view": return Resp(content=png_bytes())
        if path == "/interrupt": return Resp({})
        raise AssertionError(path)
    return handler


def comfy_env(monkeypatch):
    monkeypatch.setenv("RENDER_PROVIDER", "comfyui"); monkeypatch.setenv("COMFYUI_BASE_URL", "http://h:8188")
    monkeypatch.setenv("RENDER_WORK_EDGE", "64")
    monkeypatch.setenv("COMFYUI_WORKFLOW", str(Path(__file__).resolve().parents[3] / "workflows/inpaint_v1.api.json"))


def test_comfy_success(triple, monkeypatch):
    import requests; comfy_env(monkeypatch)
    hist = {"P1": {"status": {"status_str": "success"}, "outputs": {"9": {"images": [{"filename": "o.png"}]}}}}
    monkeypatch.setattr(requests, "request", fake_comfy(hist, []))
    r = render_edit(*triple, PROMPT, seed=5)
    assert r.provider == "comfyui" and r.seed == 5 and r.workflow_version == "inpaint_v1" and (r.width, r.height) == (300, 400)


def test_comfy_node_error(triple, monkeypatch):
    import requests; comfy_env(monkeypatch)
    monkeypatch.setattr(requests, "request", fake_comfy({"P1": {"status": {"status_str": "error"}, "outputs": {}}}, []))
    with pytest.raises(RenderFailed):
        render_edit(*triple, PROMPT)


def test_comfy_timeout_interrupts(triple, monkeypatch):
    import requests, time; comfy_env(monkeypatch)
    calls = []
    monkeypatch.setattr(requests, "request", fake_comfy({}, calls))
    monkeypatch.setattr(time, "sleep", lambda s: None)
    with pytest.raises(ProviderTimeout):
        render_edit(*triple, PROMPT, timeout_s=0)
    assert ("POST", "/interrupt") in calls


def test_comfy_unreachable(triple, monkeypatch):
    import requests; comfy_env(monkeypatch)
    def boom(*a, **k): raise requests.ConnectionError("refused")
    monkeypatch.setattr(requests, "request", boom)
    with pytest.raises(ProviderUnavailable):
        render_edit(*triple, PROMPT)
