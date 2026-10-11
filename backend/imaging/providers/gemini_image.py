"""Gemini image-edit fallback provider (§11.5).

Sends the source plus an instruction (and a red-overlay guide image marking
the mask region). The §11.4 step-4 composite is applied by
``imaging.render_edit`` for every provider, which enforces locality even
though the model has no mask input.

Env:
  GEMINI_API_KEY     (required; sent as a query param — hackathon-grade, do not
                      log it)
  GEMINI_IMAGE_MODEL default gemini-2.0-flash-preview-image-generation
"""

from __future__ import annotations

import base64
import io
import os
from pathlib import Path

import httpx
from PIL import Image

from ..errors import (
    InvalidProviderOutput,
    ProviderTimeout,
    ProviderUnavailable,
    RenderFailed,
)

WORKFLOW_VERSION = "gemini_composite_v1"


def _model() -> str:
    return os.environ.get("GEMINI_IMAGE_MODEL", "gemini-2.0-flash-preview-image-generation")


def _b64_png(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def _guide_image(source: Image.Image, mask: Image.Image) -> Image.Image:
    """Source with a translucent red overlay on the mask region."""
    s = source.convert("RGBA")
    m = mask.convert("L").resize(s.size, Image.NEAREST)
    red = Image.new("RGBA", s.size, (255, 0, 0, 90))
    return Image.composite(red, s, m).convert("RGB")


def render_at_work_size(
    work_source: Path, work_mask: Path, prompt, *, seed: int, timeout_s: int
):
    """Render via the Gemini image model. Returns (edited PIL image, model)."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ProviderUnavailable("GEMINI_API_KEY is not set")
    model = _model()

    source = Image.open(work_source).convert("RGB")
    mask = Image.open(work_mask).convert("L")
    guide = _guide_image(source, mask)

    instruction = (
        f"Edit this photo: {prompt.editGoal or prompt.positive}. "
        "Add the change ONLY inside the region outlined in red in the second "
        "(guide) image. Keep every pixel outside that region exactly identical "
        "to the first image — same lighting, perspective and materials. "
        "Photorealistic daytime street photo. "
        f"Preserve: {', '.join(prompt.preserve) if prompt.preserve else 'everything else'}. "
        "Do not add text, watermarks, people, cars, or extra objects."
    )
    body = {
        "contents": [
            {
                "parts": [
                    {"text": instruction},
                    {"inline_data": {"mime_type": "image/png", "data": _b64_png(source)}},
                    {"inline_data": {"mime_type": "image/png", "data": _b64_png(guide)}},
                ]
            }
        ],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    try:
        r = httpx.post(url, params={"key": api_key}, json=body, timeout=float(timeout_s))
    except httpx.ConnectError as e:
        raise ProviderUnavailable(f"cannot reach Gemini API: {e}")
    except httpx.TimeoutException as e:
        raise ProviderTimeout(f"Gemini image request timed out: {e}")

    if r.status_code == 429:
        raise ProviderUnavailable(f"Gemini rate limited (429): {r.text[:200]}")
    if r.status_code in (401, 403):
        raise ProviderUnavailable(f"Gemini auth failed ({r.status_code}) — check GEMINI_API_KEY")
    if r.status_code != 200:
        raise RenderFailed(f"Gemini image -> HTTP {r.status_code}: {r.text[:300]}")

    try:
        data = r.json()
    except Exception as e:
        raise InvalidProviderOutput(f"Gemini returned non-JSON: {e}")
    for cand in data.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                try:
                    img = Image.open(io.BytesIO(base64.b64decode(inline["data"]))).convert("RGB")
                except Exception as e:
                    raise InvalidProviderOutput(f"Gemini image payload undecodable: {e}")
                return img, model
    raise InvalidProviderOutput(
        f"Gemini returned no image part: {str(data)[:300]}"
    )
