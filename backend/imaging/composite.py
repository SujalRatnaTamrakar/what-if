"""Work-size resizing and the §11.4 step-4 composite."""

from __future__ import annotations

import numpy as np
from PIL import Image


def resize_to_work_edge(img: Image.Image, edge: int) -> tuple[Image.Image, tuple[int, int]]:
    """Resize so the longest edge is ``edge`` px, aspect kept, multiples of 8.

    Multiples of 8 keep SD/VAE models happy. Returns (resized, (w, h)).
    """
    w, h = img.size
    scale = edge / max(w, h)
    nw = max(8, int(round(w * scale / 8)) * 8)
    nh = max(8, int(round(h * scale / 8)) * 8)
    return img.resize((nw, nh), Image.LANCZOS), (nw, nh)


def composite_images(
    source: Image.Image,
    edited: Image.Image,
    feather_01: "np.ndarray",
) -> Image.Image:
    """final = source * (1 - m) + edited * m.

    Guarantees unmasked pixels stay identical to the source, which keeps the
    edit honest and bounded (§11.4 step 4). All inputs at the same size.
    """
    s = np.asarray(source.convert("RGB")).astype(np.float32)
    e = np.asarray(edited.convert("RGB")).astype(np.float32)
    if e.shape[:2] != s.shape[:2]:
        e = np.asarray(
            Image.fromarray(np.clip(e, 0, 255).astype(np.uint8)).resize(
                (s.shape[1], s.shape[0]), Image.LANCZOS
            )
        ).astype(np.float32)
    m = np.asarray(feather_01, dtype=np.float32)
    if m.shape != s.shape[:2]:
        raise ValueError(f"mask shape {m.shape} != image shape {s.shape[:2]}")
    m = m[..., None]
    out = s * (1.0 - m) + e * m
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")
