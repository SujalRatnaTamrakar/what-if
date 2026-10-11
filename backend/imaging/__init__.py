"""P3 image pipeline. Public interface (frozen, master plan section 11.2):
render_edit, outside_mask_change, RenderResult."""
import logging
import os
import random
import tempfile
import time
from pathlib import Path

from PIL import Image

from . import masks as _masks
from ._errors import ProviderTimeout, ProviderUnavailable, RenderFailed
from .composite import composite, work_size
from .metrics import outside_mask_change
from .providers import get_renderer
from .types import RenderResult

__all__ = ["render_edit", "outside_mask_change", "RenderResult"]
log = logging.getLogger("imaging")


def _fallback_name():
    """Optional RENDER_FALLBACK_PROVIDER. 'fake' is never allowed as a fallback: a fake image must not
    silently replace a real one (the app only shows the fake banner when RENDER_PROVIDER=fake)."""
    primary = os.environ.get("RENDER_PROVIDER", "fake")
    fb = os.environ.get("RENDER_FALLBACK_PROVIDER", "").strip()
    if not fb or fb == primary:
        return None
    if fb == "fake":
        log.warning("RENDER_FALLBACK_PROVIDER=fake is ignored")
        return None
    return fb


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

    try:
        out = get_renderer().edit(src_w, hard, prompt, seed=seed, timeout_s=timeout_s)
    except (ProviderUnavailable, ProviderTimeout, RenderFailed) as err:
        fb = _fallback_name()
        if not fb:
            raise
        log.warning("render provider failed (%s: %s); retrying once with fallback '%s'", type(err).__name__, err, fb)
        fb_timeout = int(os.environ.get("RENDER_FALLBACK_TIMEOUT_SECONDS", "60"))
        # The result reports the provider that ACTUALLY ran (honest metadata).
        out = get_renderer(fb).edit(src_w, hard, prompt, seed=seed, timeout_s=fb_timeout)

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
