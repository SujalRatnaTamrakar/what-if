"""Worker pipeline — §9.5 step 4 of the master plan.

run_scene_job / run_preview_job execute the staged AI pipeline for one job.
agents.* and imaging.* are imported LAZILY so the backend boots even if the
sibling modules are mid-build; when they are importable but providers are
"fake", the siblings' own fake providers run. If the sibling modules cannot
be imported at all, a minimal inline fake (shaped like
shared/fixtures/proposal_ready.json) keeps the loop working end-to-end, and
the real modules are picked up automatically once they land.
"""
from __future__ import annotations

import json
import logging
import shutil
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.utils import timezone as dj_timezone

from core.exceptions import ApiError
from core.models import Asset, Job, Proposal
from core.services import events, jobs

log = logging.getLogger(__name__)

_FIXTURE_PATH = Path(__file__).resolve().parent.parent.parent.parent / "shared" / "fixtures" / "proposal_ready.json"


def _z(dt=None) -> str:
    return (dt or datetime.now(timezone.utc)).strftime("%Y-%m-%dT%H:%M:%SZ")


def _media_path(rel_path: str) -> Path:
    return Path(settings.MEDIA_ROOT) / rel_path


# ---------------------------------------------------------------- lazy imports

class _AgentsShim:
    """Inline fake used only when backend.agents cannot be imported at all."""

    def __init__(self):
        data = json.loads(_FIXTURE_PATH.read_text())
        self._scene = data["scene"]
        self._review = data["review"]
        self._title = data["title"]
        self._change = data["changeRequest"]

    def analyze_scene(self, image_path, problem_text, place_label, category="shade"):
        return dict(self._scene)

    def build_edit_prompt(self, scene, option, problem_text):
        edit_goal = option.get("editGoal") if isinstance(option, dict) else option.get("editGoal", "")
        return {
            "positive": f"photorealistic shade canopy, {edit_goal}",
            "negative": "text, watermark, people",
            "preserve": [],
            "editGoal": edit_goal,
        }

    def review_concept(self, source_path, concept_path, mask_path, option, change_request):
        return dict(self._review)

    def draft_request(self, scene, option, review, place_label, problem_text):
        return {"title": self._title, "changeRequest": self._change}


_AGENTS = None       # real backend.agents module when importable
_AGENTS_SHIM = None  # inline fake when it is not
_USE_REAL = False


def _agents():
    """Return (implementation, is_real_sibling_module)."""
    global _AGENTS, _AGENTS_SHIM, _USE_REAL
    if _AGENTS is not None or _AGENTS_SHIM is not None:
        return (_AGENTS or _AGENTS_SHIM), _USE_REAL
    try:
        from backend import agents as real  # noqa

        _AGENTS = real
        _USE_REAL = True
        log.info("pipeline: using backend.agents")
    except Exception as exc:  # sibling module not landed yet
        log.warning("pipeline: backend.agents unavailable (%s); using inline fake", exc)
        _AGENTS_SHIM = _AgentsShim()
    return (_AGENTS or _AGENTS_SHIM), _USE_REAL


def _imaging_render(source_path: Path, mask_path: Path, edit_prompt, timeout_s: int):
    """Call imaging.render_edit; inline fake if backend.imaging is missing."""
    try:
        from backend import imaging as real_imaging  # noqa
    except ImportError as exc:
        log.warning("pipeline: backend.imaging unavailable (%s); using inline fake render", exc)
        # Inline fake: copy the source as the "concept" with honest metadata.
        from backend.common.errors import ProviderError  # noqa  (exists per AGENTS.md)

        out = Path("/tmp") / f"placepatch_fake_{uuid.uuid4().hex}.jpg"
        shutil.copyfile(source_path, out)
        from PIL import Image

        with Image.open(out) as im:
            w, h = im.width, im.height

        class _FakeResult:
            provider = "fake"
            model = "fake"
            seed = None
            duration_ms = 50
            workflow_version = "inline_fake_v1"
            width = w
            height = h
            output_path = out

        return _FakeResult()

    # Real provider errors propagate so the job fails honestly (retryable)
    # instead of silently publishing the source photo as the "concept".
    return real_imaging.render_edit(
        source_path, mask_path, edit_prompt, timeout_s=timeout_s
    )


def _dump(obj) -> dict:
    """Pydantic model or dict → plain camelCase JSON dict."""
    if hasattr(obj, "model_dump"):
        return obj.model_dump(by_alias=True, mode="json")
    return dict(obj)


def _option_dict(scene: dict, option_id: str) -> dict:
    for o in scene.get("options", []):
        if o.get("id") == option_id:
            return o
    raise ApiError("VALIDATION_ERROR", field_errors={"optionId": ["Unknown option for this scene."]})


# ---------------------------------------------------------------- scene job

def run_scene_job(job: Job) -> None:
    started = time.monotonic()
    proposal = job.proposal
    asset = proposal.source
    jobs.heartbeat(job, "analyze")
    agents, _is_real = _agents()
    try:
        scene = _dump(
            agents.analyze_scene(
                _media_path(asset.file_path), proposal.problem_text, proposal.place_label, proposal.category
            )
        )
    except Exception as exc:
        _fail_provider(job, exc, "analyze")
        return
    duration_ms = int((time.monotonic() - started) * 1000)
    with transaction.atomic():
        p = Proposal.objects.select_for_update().get(pk=proposal.pk)
        if p.revision != job.base_revision:
            jobs.fail(job, "STALE_RESULT", "The proposal changed while the job ran; the result was discarded.")
            return
        p.scene = scene
        p.revision += 1
        p.save(update_fields=["scene", "revision", "updated_at"])
    jobs.complete(job)
    events.record("scene_completed", proposal_id=str(proposal.pk), user_id=str(job.owner_id),
                  data={"durationMs": duration_ms})


def _fail_provider(job: Job, exc: Exception, stage: str) -> None:
    from backend.common.errors import ProviderError  # noqa

    if isinstance(exc, ProviderError):
        jobs.fail(job, exc.code, str(exc) or exc.message, stage=stage)
    else:
        log.exception("pipeline: unexpected error in %s", stage)
        jobs.fail(job, "INTERNAL", "Something went wrong.", stage=stage)


# ---------------------------------------------------------------- preview job

def run_preview_job(job: Job) -> None:
    started = time.monotonic()
    proposal = job.proposal
    payload = job.payload or {}
    option_id = payload.get("optionId")
    mask_asset_id = payload.get("maskAssetId")
    agents, _is_real = _agents()

    if not proposal.scene:
        jobs.fail(job, "INVALID_STATE", "Scene analysis is missing.", retryable=False)
        return
    if not proposal.mask or str(proposal.mask_id) != str(mask_asset_id):
        jobs.fail(job, "INVALID_STATE", "Mask is missing or stale.", retryable=False)
        return
    scene = proposal.scene
    try:
        option = _option_dict(scene, option_id)
    except ApiError as exc:
        jobs.fail(job, exc.code, exc.message, retryable=False)
        return

    source_path = _media_path(proposal.source.file_path)
    mask_path = _media_path(proposal.mask.file_path)

    # prompt
    jobs.heartbeat(job, "prompt")
    try:
        if _is_real:
            # Real sibling module: reconstruct pydantic models for typed signatures.
            from backend.agents.schemas import Option, Scene

            scene_obj = Scene(**scene)
            option_obj = next(o for o in scene_obj.options if o.id == option_id)
            edit_prompt = agents.build_edit_prompt(scene_obj, option_obj, proposal.problem_text)
        else:
            edit_prompt = agents.build_edit_prompt(scene, option, proposal.problem_text)
    except Exception as exc:
        _fail_provider(job, exc, "prompt")
        return

    # render
    jobs.heartbeat(job, "render")
    try:
        result = _imaging_render(source_path, mask_path, edit_prompt, settings.COMFYUI_TIMEOUT_SECONDS)
    except Exception as exc:
        _fail_provider(job, exc, "render")
        return

    # store concept asset (same dims as source, per §5.8)
    if result.width != proposal.source.width or result.height != proposal.source.height:
        jobs.fail(job, "RENDER_FAILED", "Render output size mismatch.", stage="render")
        return
    concept_rel = _store_concept(result.output_path)
    concept_asset = Asset.objects.create(
        proposal=proposal,
        owner=job.owner,
        kind="concept",
        file_path=concept_rel,
        thumb_path=_make_concept_thumb(concept_rel),
        mime_type="image/jpeg",
        width=result.width,
        height=result.height,
        sha256=_sha256(_media_path(concept_rel)),
    )
    concept_path = _media_path(concept_rel)
    generation = {
        "provider": result.provider,
        "model": result.model,
        "seed": result.seed,
        "durationMs": int(result.duration_ms),
        "workflowVersion": result.workflow_version,
        "optionId": option_id,
        "createdAt": _z(),
    }

    # review (ProviderError here must NOT fail the job — §9.5 step 4)
    jobs.heartbeat(job, "review")
    try:
        if _is_real:
            from backend.agents.schemas import Option, Scene

            option_obj = next(o for o in Scene(**scene).options if o.id == option_id)
            review = _dump(
                agents.review_concept(
                    source_path, concept_path, mask_path, option_obj,
                    proposal.change_request or option.get("requestDraft", ""),
                )
            )
        else:
            review = _dump(
                agents.review_concept(
                    source_path, concept_path, mask_path, option,
                    proposal.change_request or option.get("requestDraft", ""),
                )
            )
    except Exception as exc:
        from backend.common.errors import ProviderError  # noqa

        log.warning("pipeline: review provider failed (%s); recording REVIEW_UNAVAILABLE", exc)
        review = {
            "verdict": "needs_review",
            "flags": [
                {
                    "id": "f1",
                    "code": "REVIEW_UNAVAILABLE",
                    "severity": "warning",
                    "message": "Automated review was unavailable; please inspect the concept carefully before publishing.",
                }
            ],
            "outsideMaskChange": 0.0,
            "provider": (settings.REVIEW_PROVIDER or "fake"),
            "model": (settings.REVIEW_PROVIDER or "fake"),
            "reviewedAt": _z(),
        }

    # draft
    jobs.heartbeat(job, "draft")
    try:
        if _is_real:
            from backend.agents.schemas import Option, Review, Scene

            scene_obj = Scene(**scene)
            option_obj = next(o for o in scene_obj.options if o.id == option_id)
            review_obj = Review(**review)
            draft = _dump(agents.draft_request(scene_obj, option_obj, review_obj, proposal.place_label, proposal.problem_text))
        else:
            draft = _dump(agents.draft_request(scene, option, review, proposal.place_label, proposal.problem_text))
    except Exception as exc:
        _fail_provider(job, exc, "draft")
        return

    # finalize (stale-result guard)
    jobs.heartbeat(job, "finalize")
    with transaction.atomic():
        p = Proposal.objects.select_for_update().get(pk=proposal.pk)
        if p.revision != job.base_revision:
            jobs.fail(job, "STALE_RESULT", "The proposal changed while the job ran; the result was discarded.")
            return
        p.concept = concept_asset
        p.generation = generation
        p.review = review
        if not p.text_user_edited:
            p.title = str(draft.get("title", ""))[:120]
            p.change_request = str(draft.get("changeRequest", ""))[:1500]
        p.status = "ready" if review.get("verdict") != "blocked" else "draft"
        p.revision += 1
        p.save()
    jobs.complete(job)
    events.record(
        "preview_completed",
        proposal_id=str(proposal.pk),
        user_id=str(job.owner_id),
        data={"durationMs": int((time.monotonic() - started) * 1000), "verdict": review.get("verdict")},
    )


def _sha256(path: Path) -> str:
    import hashlib

    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _store_concept(output_path: Path) -> str:
    from PIL import Image

    concepts_dir = Path(settings.MEDIA_ROOT) / "concepts"
    concepts_dir.mkdir(parents=True, exist_ok=True)
    rel = f"concepts/{uuid.uuid4().hex}.jpg"
    dest = _media_path(rel)
    with Image.open(output_path) as im:
        im.convert("RGB").save(dest, format="JPEG", quality=90)
    return rel


def _make_concept_thumb(concept_rel: str) -> str:
    from PIL import Image

    thumbs_dir = Path(settings.MEDIA_ROOT) / "thumbs"
    thumbs_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}.jpg"
    with Image.open(_media_path(concept_rel)) as im:
        im.thumbnail((512, 512), Image.LANCZOS)
        im.convert("RGB").save(thumbs_dir / name, format="JPEG", quality=82)
    return f"thumbs/{name}"
