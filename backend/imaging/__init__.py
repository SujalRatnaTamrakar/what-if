"""PlacePatch image pipeline — frozen public interface (§11.2).

Do not rename anything here without going through §15 change control.
``RENDER_PROVIDER`` env selects the provider (default ``fake``): one of
comfyui | gemini_image | openai_image | fake | fallback.
``fallback`` resolves ``RENDER_CHAIN`` (default
``gemini_image,openai_image,comfyui``) and tries each leg on transient errors
only; the winning leg's name is recorded in RenderResult.provider.
"""

from __future__ import annotations

import os
import random
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Tuple

from PIL import Image

from .composite import composite_images, resize_to_work_edge
from .errors import RenderFailed
from .masks import mask_to_alpha01, prepare_mask

# EditPrompt comes from P2's agents.schemas when it exists; otherwise a local
# dataclass with the same fields (positive/negative/preserve/editGoal) so this
# module never depends on backend/agents existing.
try:
    from agents.schemas import EditPrompt  # type: ignore
except Exception:  # pragma: no cover - agents module not created yet

    @dataclass
    class EditPrompt:
        positive: str
        negative: str = ""
        preserve: list = field(default_factory=list)
        editGoal: str = ""


@dataclass
class RenderResult:
    output_path: Path  # PNG or JPEG, SAME width/height as source
    provider: str  # actual provider used, e.g. "gemini_image" (never "fallback")
    model: str
    seed: int | None
    duration_ms: int
    workflow_version: str  # e.g. "shade_inpaint_v1" or "gemini_composite_v1"
    width: int
    height: int


# Default render chain: cloud quality first, open-weight local last.
_DEFAULT_RENDER_CHAIN = "gemini_image,openai_image,comfyui"


def get_render_provider() -> str:
    """Provider name from ``RENDER_PROVIDER`` env (default ``fake``)."""
    return os.environ.get("RENDER_PROVIDER", "fake").strip().lower() or "fake"


def _provider(name: str) -> Tuple[Callable, str]:
    if name == "comfyui":
        from .providers import comfyui

        return comfyui.render_at_work_size, comfyui.WORKFLOW_VERSION
    if name == "gemini_image":
        from .providers import gemini_image

        return gemini_image.render_at_work_size, gemini_image.WORKFLOW_VERSION
    if name == "openai_image":
        from .providers import openai_image

        return openai_image.render_at_work_size, openai_image.WORKFLOW_VERSION
    if name == "fake":
        from .providers import fake

        return fake.render_at_work_size, fake.WORKFLOW_VERSION
    raise RenderFailed(
        f"unknown RENDER_PROVIDER={name!r} (want comfyui|gemini_image|openai_image|fake|fallback)"
    )


def _render_with_fallback(
    render_legs: list[tuple[str, Callable, str]],
    work_source: Path,
    work_mask: Path,
    prompt,
    *,
    seed: int,
    timeout_s: int,
) -> Tuple[Image.Image, str, str, str]:
    """Try each render leg in order; return (edited, actual_name, model, workflow_version).

    Only transient errors (see backend.common.errors.is_transient_provider_error)
    move to the next leg. Contract violations surface immediately.
    """
    from .errors import ProviderUnavailable, is_transient_provider_error

    errors: list[str] = []
    for leg_name, render_fn, workflow_version in render_legs:
        try:
            edited, model = render_fn(
                work_source, work_mask, prompt, seed=seed, timeout_s=timeout_s
            )
        except Exception as e:
            if is_transient_provider_error(e):
                errors.append(f"{leg_name}: {e}")
                continue
            raise
        return edited, leg_name, model, workflow_version
    raise ProviderUnavailable(
        "All render providers in the fallback chain failed: " + " | ".join(errors)
    )


def render_edit(
    source_path: Path,
    mask_path: Path,
    prompt: "EditPrompt",
    *,
    seed: int | None = None,
    timeout_s: int = 240,
) -> RenderResult:
    """Run the §11.4 render flow and return a RenderResult.

    1. Load source + mask, resize to RENDER_WORK_EDGE (default 1024).
    2. Provider renders the edit at work size.
    3. Upscale to source size (LANCZOS).
    4. Composite: final = source*(1-m) + edited*m — unmasked pixels stay
       identical to the source.
    5. Save to a temp dir (P4 moves it into media) and return metadata.
    """
    name = get_render_provider()
    t0 = time.perf_counter()

    # Normalize the prompt: P2's pydantic EditPrompt uses the field name
    # `edit_goal` (alias `editGoal`); the local fallback uses `editGoal`.
    # Accept both so this module never breaks on the difference.
    prompt = EditPrompt(
        positive=getattr(prompt, "positive", "") or "",
        negative=getattr(prompt, "negative", "") or "",
        preserve=getattr(prompt, "preserve", None) or [],
        editGoal=getattr(prompt, "editGoal", None)
        or getattr(prompt, "edit_goal", "")
        or "",
    )

    source = Image.open(source_path).convert("RGB")
    work_edge = int(os.environ.get("RENDER_WORK_EDGE", "1024"))
    work_img, work_size = resize_to_work_edge(source, work_edge)
    mask = Image.open(mask_path).convert("L").resize(work_size, Image.NEAREST)

    tmpdir = Path(tempfile.mkdtemp(prefix="placepatch_render_"))
    work_source = tmpdir / "work_source.png"
    work_mask = tmpdir / "work_mask.png"
    work_img.save(work_source)
    mask.save(work_mask)

    if seed is None:
        seed = random.randint(0, 2**31 - 1)

    if name == "fallback":
        raw = os.environ.get("RENDER_CHAIN", _DEFAULT_RENDER_CHAIN)
        leg_names = [n.strip().lower() for n in raw.split(",") if n.strip()]
        if not leg_names:
            raise RenderFailed("RENDER_CHAIN is empty; need at least one provider")
        legs = [(n, *_provider(n)) for n in leg_names]
        edited, actual_name, model, workflow_version = _render_with_fallback(
            legs, work_source, work_mask, prompt, seed=seed, timeout_s=timeout_s
        )
        name = actual_name  # honest provenance: the leg that actually rendered
    else:
        render_fn, workflow_version = _provider(name)
        edited, model = render_fn(
            work_source, work_mask, prompt, seed=seed, timeout_s=timeout_s
        )
    edited = edited.convert("RGB").resize(source.size, Image.LANCZOS)

    feathered = prepare_mask(mask, size=source.size)  # dilate ~8px + RENDER_FEATHER_PX
    final = composite_images(source, edited, mask_to_alpha01(feathered))

    out_path = tmpdir / "concept.png"
    final.save(out_path)
    return RenderResult(
        output_path=out_path,
        provider=name,
        model=model,
        seed=seed,
        duration_ms=int((time.perf_counter() - t0) * 1000),
        workflow_version=workflow_version,
        width=source.width,
        height=source.height,
    )


def outside_mask_change(
    source_path: Path, concept_path: Path, mask_path: Path
) -> float:
    """Mean absolute pixel difference (0..1) in the region where mask == 0."""
    import numpy as np

    s = Image.open(source_path).convert("RGB")
    c = Image.open(concept_path).convert("RGB")
    if c.size != s.size:
        c = c.resize(s.size, Image.LANCZOS)
    m = Image.open(mask_path).convert("L").resize(s.size, Image.NEAREST)

    keep = np.asarray(m) < 128  # mask == 0 region (PNG path: pixels <128 = keep)
    if not keep.any():
        return 0.0
    sd = np.asarray(s).astype(np.float32)
    cd = np.asarray(c).astype(np.float32)
    diff = np.abs(sd - cd).mean(axis=2) / 255.0
    return float(diff[keep].mean())


__all__ = [
    "EditPrompt",
    "RenderResult",
    "get_render_provider",
    "render_edit",
    "outside_mask_change",
]
