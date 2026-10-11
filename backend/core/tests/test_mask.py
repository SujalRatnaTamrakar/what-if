"""Mask rasterization tests — §5.7 / §9.6."""
from __future__ import annotations

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from core.exceptions import ApiError
from core.services.masks import rasterize_strokes, validate_png_mask

pytestmark = pytest.mark.django_db

W, H = 400, 800  # portrait source


def center_strokes():
    # A short horizontal brush: single dots cannot reach the 0.5% minimum
    # coverage on a 400x800 image (§5.7), so the stroke has real length.
    return {"version": 1, "strokes": [{"mode": "paint", "width": 0.1, "points": [[0.3, 0.5], [0.7, 0.5]]}]}


def test_rasterize_center_dot_is_white_at_center():
    rel, cov = rasterize_strokes(center_strokes(), W, H)
    assert 0.005 <= cov <= 0.60
    from django.conf import settings
    from pathlib import Path

    img = Image.open(Path(settings.MEDIA_ROOT) / rel)
    assert img.mode == "L" and img.size == (W, H)
    assert img.getpixel((W // 2, H // 2)) == 255
    assert img.getpixel((10, 10)) == 0


def test_rasterize_erase_carves_hole():
    strokes = {
        "version": 1,
        "strokes": [
            {"mode": "paint", "width": 0.2, "points": [[0.5, 0.5]]},
            {"mode": "erase", "width": 0.1, "points": [[0.5, 0.5]]},
        ],
    }
    rel, _cov = rasterize_strokes(strokes, W, H)
    from django.conf import settings
    from pathlib import Path

    img = Image.open(Path(settings.MEDIA_ROOT) / rel)
    assert img.getpixel((W // 2, H // 2)) == 0  # erased back to black


def test_rasterize_empty_raises_mask_empty():
    with pytest.raises(ApiError) as ei:
        rasterize_strokes({"version": 1, "strokes": []}, W, H)
    assert ei.value.code == "MASK_EMPTY"


def test_rasterize_too_large_raises():
    strokes = {
        "version": 1,
        "strokes": [
            {"mode": "paint", "width": 1.0, "points": [[0.0, 0.25], [1.0, 0.25]]},
            {"mode": "paint", "width": 1.0, "points": [[0.0, 0.75], [1.0, 0.75]]},
        ],
    }
    with pytest.raises(ApiError) as ei:
        rasterize_strokes(strokes, W, H)
    assert ei.value.code == "MASK_TOO_LARGE"


def test_rasterize_limits_enforced():
    with pytest.raises(ApiError) as ei:
        rasterize_strokes({"version": 2, "strokes": []}, W, H)
    assert ei.value.code == "VALIDATION_ERROR"
    many = {"version": 1, "strokes": [{"mode": "paint", "width": 0.01, "points": [[0.5, 0.5]]}] * 201}
    with pytest.raises(ApiError) as ei:
        rasterize_strokes(many, W, H)
    assert ei.value.code == "VALIDATION_ERROR"


def _png_file(w, h, white=True):
    img = Image.new("L", (w, h), 255 if white else 0)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return SimpleUploadedFile("mask.png", buf.read(), content_type="image/png")


def test_png_path_size_mismatch():
    with pytest.raises(ApiError) as ei:
        validate_png_mask(_png_file(100, 100), W, H)
    assert ei.value.code == "MASK_SIZE_MISMATCH"


def test_png_path_too_large():
    with pytest.raises(ApiError) as ei:
        validate_png_mask(_png_file(W, H, white=True), W, H)
    assert ei.value.code == "MASK_TOO_LARGE"


def test_png_path_ok():
    # Half-white image → 50% coverage, within limits.
    img = Image.new("L", (W, H), 0)
    px = img.load()
    for x in range(W // 2):
        for y in range(H):
            px[x, y] = 255
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    f = SimpleUploadedFile("mask.png", buf.read(), content_type="image/png")
    rel, cov = validate_png_mask(f, W, H)
    assert abs(cov - 0.5) < 0.01
    assert rel.endswith(".png")
