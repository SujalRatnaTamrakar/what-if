import numpy as np
from PIL import Image


def work_size(w: int, h: int, edge: int):
    """Scale so the longest edge == edge, both sides rounded to a multiple of 8."""
    s = edge / max(w, h)
    return max(8, int(round(w * s / 8)) * 8), max(8, int(round(h * s / 8)) * 8)


def composite(source: Image.Image, edited: Image.Image, soft_mask: Image.Image) -> Image.Image:
    """final = source*(1-m) + edited*m, so pixels outside the (feathered) mask equal the source."""
    s = np.asarray(source.convert("RGB"), dtype=np.float32)
    e = np.asarray(edited.convert("RGB"), dtype=np.float32)
    m = np.asarray(soft_mask.convert("L"), dtype=np.float32)[..., None] / 255.0
    out = s * (1.0 - m) + e * m
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8), "RGB")
