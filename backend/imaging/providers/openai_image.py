"""OpenAI image-edit provider (§11.5).

POST https://api.openai.com/v1/images/edits (multipart) with the source PNG
and a mask PNG whose TRANSPARENT areas mark the edit region (OpenAI
convention — the inverse of our L-mask, built below). The §11.4 step-4
composite is applied by ``imaging.render_edit`` for every provider, which
enforces mask locality on top of the model output.

Env:
  OPENAI_API_KEY    (required)
  OPENAI_IMAGE_MODEL default gpt-image-1

Error mapping (drives the fallback chain):
  429 / 5xx / 404 retired-model / timeout / connection -> ProviderUnavailable
  401 / 403                                            -> ProviderUnavailable
  other non-200                                        -> RenderFailed (surfaces;
                                                          never retried on another leg,
                                                          except 404-ish messages)
"""
from __future__ import annotations

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

WORKFLOW_VERSION = "openai_composite_v1"


def _model() -> str:
    return os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1")


def _png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _openai_mask(work_mask: Path, size) -> bytes:
    """Build OpenAI's mask PNG: transparent where our mask says EDIT (255)."""
    m = Image.open(work_mask).convert("L").resize(size, Image.NEAREST)
    rgba = Image.new("RGBA", size, (0, 0, 0, 255))
    # alpha = 255 - mask: edit region (mask 255) becomes transparent.
    alpha = m.point(lambda v: 255 - v)
    rgba.putalpha(alpha)
    return _png_bytes(rgba)


def render_at_work_size(
    work_source: Path, work_mask: Path, prompt, *, seed: int, timeout_s: int
):
    """Render via the OpenAI image-edit API. Returns (edited PIL image, model)."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ProviderUnavailable("OPENAI_API_KEY is not set")
    model = _model()

    source = Image.open(work_source).convert("RGB")
    instruction = (
        f"Edit this photo: {getattr(prompt, 'editGoal', None) or getattr(prompt, 'positive', '')}. "
        "Change ONLY the area indicated by the transparent region of the mask. "
        "Keep every pixel outside that region exactly identical — same lighting, "
        "perspective and materials. Photorealistic daytime street photo. "
        f"Preserve: {', '.join(getattr(prompt, 'preserve', None) or []) or 'everything else'}. "
        "Do not add text, watermarks, people, cars, or extra objects."
    )

    files = {
        "image": ("source.png", _png_bytes(source), "image/png"),
        "mask": ("mask.png", _openai_mask(work_mask, source.size), "image/png"),
    }
    data = {"model": model, "prompt": instruction}

    try:
        r = httpx.post(
            "https://api.openai.com/v1/images/edits",
            headers={"Authorization": f"Bearer {api_key}"},
            files=files,
            data=data,
            timeout=float(timeout_s),
        )
    except httpx.ConnectError as e:
        raise ProviderUnavailable(f"cannot reach OpenAI API: {e}")
    except httpx.TimeoutException as e:
        raise ProviderTimeout(f"OpenAI image request timed out: {e}")

    if r.status_code == 429:
        raise ProviderUnavailable(f"OpenAI rate limited (429): {r.text[:200]}")
    if r.status_code in (401, 403):
        raise ProviderUnavailable(f"OpenAI auth failed ({r.status_code}) — check OPENAI_API_KEY")
    if r.status_code == 404:
        raise ProviderUnavailable(f"OpenAI image model not found (404, retired?): {r.text[:200]}")
    if r.status_code >= 500:
        raise ProviderUnavailable(f"OpenAI server error ({r.status_code}): {r.text[:200]}")
    if r.status_code != 200:
        raise RenderFailed(f"OpenAI image -> HTTP {r.status_code}: {r.text[:300]}")

    try:
        payload = r.json()
    except Exception as e:
        raise InvalidProviderOutput(f"OpenAI returned non-JSON: {e}")

    import base64

    for item in payload.get("data", []):
        b64 = item.get("b64_json")
        url = item.get("url")
        try:
            if b64:
                img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
                return img, model
            if url:
                dl = httpx.get(url, timeout=30.0)
                dl.raise_for_status()
                img = Image.open(io.BytesIO(dl.content)).convert("RGB")
                return img, model
        except (ProviderUnavailable, ProviderTimeout):
            raise
        except Exception as e:
            raise InvalidProviderOutput(f"OpenAI image payload undecodable: {e}")
    raise InvalidProviderOutput(f"OpenAI returned no image data: {str(payload)[:300]}")
