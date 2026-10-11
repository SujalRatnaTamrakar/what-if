"""Mask preparation for rendering and compositing (§11.3).

Input: P4's mask PNG — mode L, same size as the source, 255 = edit region.
Prep: dilate by ~8 px, then Gaussian feather. Feather radius comes from the
``RENDER_FEATHER_PX`` env var (default 12), never hardcoded anywhere else.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Union

import numpy as np
from PIL import Image, ImageFilter

MaskLike = Union[str, Path, Image.Image]


def _as_image(mask: MaskLike) -> Image.Image:
    if isinstance(mask, Image.Image):
        return mask.convert("L")
    return Image.open(mask).convert("L")


def prepare_mask(
    mask: MaskLike,
    *,
    size: tuple[int, int] | None = None,
    dilate_px: int = 8,
    feather_px: int | None = None,
) -> Image.Image:
    """Return the mask as a mode-L image, dilated and feathered.

    - ``size``: if given, the mask is resized to it first (NEAREST).
    - ``dilate_px``: MaxFilter radius growth (~8 px per §11.3).
    - ``feather_px``: Gaussian blur radius; defaults to ``RENDER_FEATHER_PX``.
    """
    if feather_px is None:
        feather_px = int(os.environ.get("RENDER_FEATHER_PX", "12"))
    m = _as_image(mask)
    if size is not None and m.size != size:
        m = m.resize(size, Image.NEAREST)
    if dilate_px and dilate_px > 0:
        m = m.filter(ImageFilter.MaxFilter(dilate_px * 2 + 1))
    if feather_px and feather_px > 0:
        m = m.filter(ImageFilter.GaussianBlur(feather_px))
    return m


def mask_to_alpha01(mask: Image.Image) -> "np.ndarray":
    """Feathered mask as float32 HxW array in [0, 1]."""
    return np.asarray(mask.convert("L")).astype(np.float32) / 255.0


def coverage(mask: MaskLike) -> float:
    """Fraction of pixels >= 128 (edit region), mirroring the PNG-path rule."""
    m = _as_image(mask)
    a = np.asarray(m)
    return float((a >= 128).mean())
