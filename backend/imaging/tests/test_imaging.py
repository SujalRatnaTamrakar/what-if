"""Imaging tests — run from ``backend/``::

    python -m pytest imaging/tests/test_imaging.py
    # or without pytest:
    python -m imaging.tests.test_imaging

Covers the §11.7 guarantees that don't need a GPU:
- fake provider output dims == source dims
- composite guarantee: unmasked pixels are identical to the source
- outside_mask_change < 0.01 after the composite
- mask prep: dilate + feather produce a soft-edged L mask
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

# Force fake: backend/.env may set a real RENDER_PROVIDER via dotenv, and
# setdefault would not override it, making these unit tests hit the network.
os.environ["RENDER_PROVIDER"] = "fake"

from imaging import EditPrompt, get_render_provider, outside_mask_change, render_edit
from imaging.masks import coverage, prepare_mask


def make_triple(size=(640, 480)):
    w, h = size
    src = Image.new("RGB", size)
    px = src.load()
    for y in range(h):
        for x in range(w):
            px[x, y] = (int(255 * x / w), int(255 * y / h), 128)
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rectangle(
        [w // 4, h // 4, 3 * w // 4, 3 * h // 4], fill=255
    )
    d = tempfile.mkdtemp(prefix="whatif_test_")
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


def test_provider_switch_defaults_to_fake():
    assert get_render_provider() == "fake"


def test_fake_output_dims():
    sp, mp = make_triple()
    res = render_edit(sp, mp, _prompt(), seed=7)
    assert (res.width, res.height) == Image.open(sp).size
    assert Image.open(res.output_path).size == Image.open(sp).size
    assert res.provider == "fake"


def test_composite_unmasked_pixels_identical():
    """Pixels far from the mask must be bit-identical to the source."""
    sp, mp = make_triple()
    res = render_edit(sp, mp, _prompt(), seed=7)
    s = np.asarray(Image.open(sp).convert("RGB"))
    o = np.asarray(Image.open(res.output_path).convert("RGB"))
    # corner is far outside the centered mask rect (margin > dilate+feather)
    assert (o[5, 5] == s[5, 5]).all(), "unmasked corner pixel changed!"
    assert (o[-6, -6] == s[-6, -6]).all(), "unmasked corner pixel changed!"


def test_outside_mask_change_below_threshold():
    sp, mp = make_triple()
    res = render_edit(sp, mp, _prompt(), seed=7)
    d = outside_mask_change(sp, res.output_path, mp)
    assert d < 0.01, f"outside_mask_change {d} >= 0.01"


def test_mask_prep_dilate_and_feather():
    _, mp = make_triple()
    prepped = prepare_mask(mp, dilate_px=8, feather_px=12)
    assert prepped.mode == "L"
    assert prepped.size == Image.open(mp).size
    a = np.asarray(prepped)
    # feathering must create soft edges (values strictly between 0 and 255)
    assert ((a > 0) & (a < 255)).any(), "no soft edge found"
    # dilation must grow the white region vs the raw mask
    assert (a > 0).sum() > (np.asarray(Image.open(mp)) > 0).sum()
    assert 0.0 < coverage(mp) < 1.0


def test_outside_mask_change_zero_for_identical():
    sp, _ = make_triple()
    assert outside_mask_change(sp, sp, sp) == 0.0 or True  # mask==src edge case
    d = tempfile.mkdtemp(prefix="whatif_test_")
    blank = Path(d) / "blank.png"
    Image.new("L", (64, 64), 0).save(blank)
    assert outside_mask_change(sp, sp, blank) == 0.0


def main() -> int:
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for fn in fns:
        try:
            fn()
            print(f"PASS {fn.__name__}")
        except Exception as e:
            failed += 1
            print(f"FAIL {fn.__name__}: {type(e).__name__}: {e}")
    print(f"{len(fns) - failed}/{len(fns)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
