"""Mask rasterization — §5.7 of the master plan.

Clients send strokes in normalized coordinates; the backend rasterizes them
at the source image's exact pixel size into an L-mode PNG (255 = edit).
Coverage must be 0.5%–60% of pixels.
"""
from __future__ import annotations

import uuid
from pathlib import Path

from django.conf import settings
from PIL import Image, ImageDraw

from core.exceptions import ApiError

_MAX_STROKES = 200
_MAX_POINTS = 5000
_MIN_COVERAGE = 0.005
_MAX_COVERAGE = 0.60


def _validate_strokes(strokes: dict) -> list[dict]:
    if not isinstance(strokes, dict) or strokes.get("version") != 1:
        raise ApiError("VALIDATION_ERROR", field_errors={"strokes": ["version must be 1."]})
    raw = strokes.get("strokes")
    if not isinstance(raw, list):
        raise ApiError("VALIDATION_ERROR", field_errors={"strokes": ["strokes must be a list."]})
    if len(raw) > _MAX_STROKES:
        raise ApiError("VALIDATION_ERROR", field_errors={"strokes": [f"At most {_MAX_STROKES} strokes."]})
    total_points = 0
    for i, s in enumerate(raw):
        if not isinstance(s, dict) or s.get("mode") not in ("paint", "erase"):
            raise ApiError("VALIDATION_ERROR", field_errors={"strokes": [f"Stroke {i}: mode must be paint or erase."]})
        w = s.get("width")
        if not isinstance(w, (int, float)) or not (0 < w <= 1):
            raise ApiError("VALIDATION_ERROR", field_errors={"strokes": [f"Stroke {i}: width must be in (0, 1]."]})
        pts = s.get("points")
        if not isinstance(pts, list) or not pts:
            raise ApiError("VALIDATION_ERROR", field_errors={"strokes": [f"Stroke {i}: points must be non-empty."]})
        total_points += len(pts)
        for p in pts:
            if (
                not isinstance(p, (list, tuple)) or len(p) != 2
                or not all(isinstance(c, (int, float)) and 0 <= c <= 1 for c in p)
            ):
                raise ApiError("VALIDATION_ERROR", field_errors={"strokes": [f"Stroke {i}: points must be [x, y] in [0, 1]."]})
    if total_points > _MAX_POINTS:
        raise ApiError("VALIDATION_ERROR", field_errors={"strokes": [f"At most {_MAX_POINTS} points in total."]})
    return raw


def _coverage(img: Image.Image) -> float:
    hist = img.histogram()
    nonzero = sum(hist[1:])
    return nonzero / (img.width * img.height)


def _check_coverage(img: Image.Image) -> None:
    cov = _coverage(img)
    if cov < _MIN_COVERAGE:
        raise ApiError("MASK_EMPTY")
    if cov > _MAX_COVERAGE:
        raise ApiError("MASK_TOO_LARGE")


def _save_mask(img: Image.Image) -> tuple[Path, str]:
    masks_dir = Path(settings.MEDIA_ROOT) / "masks"
    masks_dir.mkdir(parents=True, exist_ok=True)
    rel_name = f"{uuid.uuid4().hex}.png"
    out_path = masks_dir / rel_name
    img.save(out_path, format="PNG")
    return out_path, f"masks/{rel_name}"


def rasterize_strokes(strokes: dict, width: int, height: int) -> tuple[str, float]:
    """Rasterize normalized strokes → PNG mask. Returns (rel_path, coverage)."""
    parsed = _validate_strokes(strokes)
    canvas = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(canvas)
    for s in parsed:
        color = 255 if s["mode"] == "paint" else 0
        r = (float(s["width"]) * width) / 2.0
        pts = [(float(x) * width, float(y) * height) for x, y in s["points"]]
        lw = max(1, int(round(2 * r)))
        if len(pts) == 1:
            x, y = pts[0]
            draw.ellipse([x - r, y - r, x + r, y + r], fill=color)
        else:
            draw.line(pts, fill=color, width=lw, joint="curve")
            for x, y in pts:
                draw.ellipse([x - r, y - r, x + r, y + r], fill=color)
    # Binarize (antialiased edges → 255/0).
    canvas = canvas.point(lambda v: 255 if v >= 128 else 0, mode="L")
    _check_coverage(canvas)
    _, rel = _save_mask(canvas)
    return rel, _coverage(canvas)


def validate_png_mask(uploaded_file, width: int, height: int) -> tuple[str, float]:
    """Alternate PNG path: exact source size, pixels >= 128 count as edit."""
    try:
        img = Image.open(uploaded_file)
        img.load()
    except Exception:
        raise ApiError("VALIDATION_ERROR", field_errors={"mask": ["Not a readable PNG."]})
    if img.width != width or img.height != height:
        raise ApiError("MASK_SIZE_MISMATCH")
    gray = img.convert("L").point(lambda v: 255 if v >= 128 else 0, mode="L")
    _check_coverage(gray)
    _, rel = _save_mask(gray)
    try:
        uploaded_file.close()
    except Exception:
        pass
    return rel, _coverage(gray)
