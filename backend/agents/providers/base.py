"""Base provider interface (§10.4) plus shared image helpers."""
from __future__ import annotations

import io
from pathlib import Path

from PIL import Image


class LLMProvider:
    """Structured-JSON LLM provider.

    ``generate_json`` must return a plain ``dict`` (parsed JSON). It raises
    ``ProviderUnavailable`` / ``ProviderTimeout`` on transport failures and
    ``InvalidProviderOutput`` when the response cannot be parsed as JSON.
    """

    name = "base"
    model = ""
    timeout = 60

    def generate_json(
        self,
        system: str,
        user: str,
        images: list[Path],
        schema: dict,
        timeout: int,
    ) -> dict:
        raise NotImplementedError


def prep_image_bytes(image_path: Path | str, max_edge: int = 1024) -> bytes:
    """Downscale an image to ``max_edge`` px and return JPEG bytes (§10.4)."""
    img = Image.open(image_path).convert("RGB")
    w, h = img.size
    scale = min(1.0, max_edge / max(w, h))
    if scale < 1.0:
        img = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    return buf.getvalue()


def parse_json_text(text: str, source: str):
    """Parse possibly fence-wrapped JSON text; never returns garbage."""
    from backend.common.errors import InvalidProviderOutput

    t = text.strip()
    if t.startswith("```"):
        # strip markdown fences: ```json ... ```
        lines = t.splitlines()
        lines = [ln for ln in lines if not ln.strip().startswith("```")]
        t = "\n".join(lines).strip()
    import json

    try:
        return json.loads(t)
    except json.JSONDecodeError as e:
        raise InvalidProviderOutput(
            f"{source} returned unparseable JSON: {e}. First 200 chars: {t[:200]!r}"
        )
