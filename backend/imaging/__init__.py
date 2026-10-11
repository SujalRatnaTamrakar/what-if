"""P3 image pipeline. Public interface (frozen, master plan section 11.2):
render_edit, outside_mask_change, RenderResult."""
import os
import random
import tempfile
import time
from pathlib import Path

from PIL import Image

from . import masks as _masks
from .composite import composite, work_size
from .metrics import outside_mask_change
from .providers import get_renderer
from .types import RenderResult

__all__ = ["render_edit", "outside_mask_change", "RenderResult"]


def render_edit(source_path: Path, mask_path: Path, prompt, *, seed: "int | None" = None,
                timeout_s: int = 240) -> RenderResult:
    t0 = time.time()
    edge = int(os.environ.get("RENDER_WORK_EDGE", "1024"))
    feather = int(os.environ.get("RENDER_FEATHER_PX", "12"))
    seed = seed if seed is not None else random.randint(0, 2**31 - 1)

    src = Image.open(source_path).convert("RGB")
    mask = _masks.load_mask(Path(mask_path), src.size)          # raises RenderFailed("mask size mismatch")

    ws = work_size(*src.size, edge)
    src_w = src.resize(ws, Image.LANCZOS)
    mask_w = mask.resize(ws, Image.NEAREST).point(lambda v: 255 if v >= 128 else 0)
    hard, soft = _masks.prepare(mask_w, dilate_px=8, feather_px=feather)

    out = get_renderer().edit(src_w, hard, prompt, seed=seed, timeout_s=timeout_s)

    edited = out.image.convert("RGB").resize(src.size, Image.LANCZOS)
    final = composite(src, edited, soft.resize(src.size, Image.BILINEAR))

    out_path = Path(tempfile.mkdtemp(prefix="whatif_render_")) / "concept.png"
    final.save(out_path)
    return RenderResult(output_path=out_path, provider=out.provider, model=out.model, seed=out.seed,
                        duration_ms=int((time.time() - t0) * 1000), workflow_version=out.workflow_version,
                        width=final.width, height=final.height)


def composite_external(source_path: Path, edited_path: Path, mask_path: Path, out_path: Path) -> Path:
    """Dev helper (not part of the frozen API): keep an image edited elsewhere ONLY inside the mask."""
    edge = int(os.environ.get("RENDER_WORK_EDGE", "1024"))
    feather = int(os.environ.get("RENDER_FEATHER_PX", "12"))
    src = Image.open(source_path).convert("RGB")
    mask = _masks.load_mask(Path(mask_path), src.size)
    _, soft = _masks.prepare(mask.resize(work_size(*src.size, edge), Image.NEAREST), 8, feather)
    edited = Image.open(edited_path).convert("RGB").resize(src.size, Image.LANCZOS)
    final = composite(src, edited, soft.resize(src.size, Image.BILINEAR))
    final.save(out_path)
    return Path(out_path)
