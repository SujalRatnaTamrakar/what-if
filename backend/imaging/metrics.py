from pathlib import Path
import numpy as np
from PIL import Image
from ._errors import RenderFailed
from .masks import dilate


def outside_mask_change(source_path: Path, concept_path: Path, mask_path: Path) -> float:
    """Mean |source - concept| / 255 (RGB averaged) over the keep region:
    mask == 0 AND outside the 8 px dilation band, so feathering does not count. ~0.0 after a correct composite."""
    s = Image.open(source_path).convert("RGB")
    c = Image.open(concept_path).convert("RGB")
    m = Image.open(mask_path).convert("L")
    if not (s.size == c.size == m.size):
        raise RenderFailed("size mismatch between source, concept and mask")
    m = m.point(lambda v: 255 if v >= 128 else 0)
    keep = np.asarray(dilate(m, 8)) == 0
    n = int(keep.sum())
    if n == 0:
        return 0.0
    diff = np.abs(np.asarray(s, dtype=np.float32) - np.asarray(c, dtype=np.float32)) / 255.0
    return float(diff.mean(axis=2)[keep].mean())
