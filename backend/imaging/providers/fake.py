"""Fake render provider — dev only.

Draws a semi-transparent teal fill plus "FAKE RENDER" text inside the mask
region. Never used silently: the app shows a banner whenever the config
reports a fake renderer (§1 honesty rules).
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WORKFLOW_VERSION = "fake_v1"


def render_at_work_size(
    work_source: Path, work_mask: Path, prompt, *, seed: int, timeout_s: int
):
    """Return (fake-edited PIL image at work size, model name)."""
    img = Image.open(work_source).convert("RGBA")
    mask = Image.open(work_mask).convert("L").resize(img.size, Image.NEAREST)

    teal = Image.new("RGBA", img.size, (0, 150, 150, 110))
    img = Image.composite(teal, img, mask)

    bbox = mask.getbbox()
    if bbox:
        cx = (bbox[0] + bbox[2]) // 2
        cy = (bbox[1] + bbox[3]) // 2
        d = ImageDraw.Draw(img)
        try:
            font = ImageFont.truetype("DejaVuSans-Bold.ttf", size=max(12, img.size[0] // 28))
        except Exception:
            font = ImageFont.load_default()
        d.text((cx, cy), "FAKE RENDER", fill=(255, 255, 255, 255), font=font, anchor="mm")

    return img.convert("RGB"), "fake"
