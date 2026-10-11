"""E5–E11, E13 — proposal endpoints."""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core import serializers
from core.exceptions import ApiError
from core.models import Asset, Proposal
from core.permissions import require_auth, try_auth
from core.services import events, jobs
from core.services.images import sanitize_upload
from core.services.masks import rasterize_strokes, validate_png_mask
from core.views.helpers import (
    check_revision,
    decode_cursor,
    encode_cursor,
    ensure_no_active_job,
    get_owned_proposal,
    get_visible_proposal,
)


def _field_errors(**kwargs) -> ApiError:
    return ApiError("VALIDATION_ERROR", field_errors={k: v for k, v in kwargs.items() if v})


# ---------------------------------------------------------------- E5 / E6


@api_view(["GET", "POST"])
def proposals(request):
    if request.method == "POST":
        return _create_proposal(request)
    return _list_proposals(request)


def _create_proposal(request):
    user = require_auth(request)
    data = request.data

    field_errors: dict[str, list[str]] = {}
    place_label = (data.get("placeLabel") or "").strip()
    problem_text = (data.get("problemText") or "").strip()
    category = data.get("category")
    consent = data.get("consent")
    photo = data.get("photo")

    if not (3 <= len(place_label) <= 120):
        field_errors["placeLabel"] = ["Must be 3–120 characters."]
    if not (10 <= len(problem_text) <= 500):
        field_errors["problemText"] = ["Must be 10–500 characters."]
    if category != "shade":
        field_errors["category"] = ["Only 'shade' is supported in this version."]
    if photo is None:
        field_errors["photo"] = ["A photo is required."]
    if field_errors:
        raise ApiError("VALIDATION_ERROR", field_errors=field_errors)
    if consent != "true" and consent is not True:
        raise ApiError("CONSENT_REQUIRED")

    sanitized = sanitize_upload(photo)
    with transaction.atomic():
        asset = Asset.objects.create(
            proposal=None,
            owner=user,
            kind="source",
            file_path=sanitized.rel_path,
            thumb_path=sanitized.thumb_rel_path,
            mime_type="image/jpeg",
            width=sanitized.width,
            height=sanitized.height,
            sha256=sanitized.sha256,
        )
        proposal = Proposal.objects.create(
            owner=user,
            status="draft",
            revision=1,
            category="shade",
            place_label=place_label,
            problem_text=problem_text,
            consent_at=timezone.now(),
            source=asset,
        )
        asset.proposal = proposal
        asset.save(update_fields=["proposal"])
        job = jobs.enqueue("scene", proposal)
    events.record("proposal_created", proposal_id=str(proposal.id), user_id=str(user.id))
    body = serializers.proposal_dict(proposal, user, active_job=job)
    return Response({"proposal": body, "jobId": str(job.id)}, status=http_status.HTTP_201_CREATED)


def _list_proposals(request):
    scope = request.query_params.get("scope")
    if scope not in ("public", "mine"):
        raise _field_errors(scope=["Must be 'public' or 'mine'."])
    try:
        limit = int(request.query_params.get("limit", 20))
    except (TypeError, ValueError):
        raise _field_errors(limit=["Must be an integer."])
    limit = max(1, min(limit, 100))

    viewer = try_auth(request)
    if scope == "mine":
        viewer = require_auth(request)
        qs = Proposal.objects.filter(owner=viewer).select_related("owner", "source", "concept")
        order_field, cursor_field = "updated_at", "updatedAt"
    else:
        qs = Proposal.objects.filter(status="published").select_related("owner", "source", "concept")
        order_field, cursor_field = "published_at", "publishedAt"

    cursor = request.query_params.get("cursor")
    if cursor:
        ts_iso, obj_id = decode_cursor(cursor)
        qs = qs.filter(
            **{f"{order_field}__lt": ts_iso}
        ) | qs.filter(**{order_field: ts_iso, "id__lt": obj_id})

    qs = qs.order_by(f"-{order_field}", "-id")
    items = list(qs[: limit + 1])
    next_cursor = None
    if len(items) > limit:
        items = items[:limit]
        last = items[-1]
        last_ts = getattr(last, order_field)
        next_cursor = encode_cursor(last_ts.strftime("%Y-%m-%dT%H:%M:%SZ"), str(last.id))

    return Response(
        {
            "items": [serializers.proposal_summary_dict(p, viewer) for p in items],
            "nextCursor": next_cursor,
        }
    )


# ---------------------------------------------------------------- E7 / E8


@api_view(["GET", "PATCH"])
def proposal_detail(request, proposal_id):
    if request.method == "GET":
        p, viewer = get_visible_proposal(request, proposal_id)
        return Response(serializers.proposal_dict(p, viewer, active_job=jobs.active_job_for(p)))
    return _patch_proposal(request, proposal_id)


def _patch_proposal(request, proposal_id):
    p, viewer = get_owned_proposal(request, proposal_id)  # draft/ready only
    data = request.data or {}
    check_revision(p, data.get("expectedRevision"))
    ensure_no_active_job(p)

    field_errors: dict[str, list[str]] = {}
    updates: dict = {}

    if "title" in data:
        title = data["title"]
        if not isinstance(title, str) or len(title) > 120:
            field_errors["title"] = ["At most 120 characters."]
        else:
            updates["title"] = title
    if "changeRequest" in data:
        cr = data["changeRequest"]
        if not isinstance(cr, str) or len(cr) > 1500:
            field_errors["changeRequest"] = ["At most 1500 characters."]
        else:
            updates["changeRequest"] = cr
    if "placeLabel" in data:
        pl = (data["placeLabel"] or "").strip()
        if not (3 <= len(pl) <= 120):
            field_errors["placeLabel"] = ["Must be 3–120 characters."]
        else:
            updates["place_label"] = pl
    if "recipientLabel" in data:
        rl = data["recipientLabel"]
        if not isinstance(rl, str) or len(rl) > 120:
            field_errors["recipientLabel"] = ["At most 120 characters."]
        else:
            updates["recipient_label"] = rl
    if "selectedOptionId" in data:
        oid = data["selectedOptionId"]
        option_ids = {o.get("id") for o in (p.scene or {}).get("options", [])}
        if oid not in option_ids:
            field_errors["selectedOptionId"] = ["Unknown option for this scene."]
        else:
            updates["selected_option_id"] = oid
    if field_errors:
        raise ApiError("VALIDATION_ERROR", field_errors=field_errors)

    with transaction.atomic():
        p = Proposal.objects.select_for_update().get(pk=p.pk)
        if p.status == "published":
            raise ApiError("INVALID_STATE")
        for k, v in updates.items():
            setattr(p, k, v)
        if "title" in updates or "changeRequest" in updates:
            p.text_user_edited = True
        p.revision += 1
        p.save()
    p, viewer = get_visible_proposal(request, proposal_id)
    return Response(serializers.proposal_dict(p, viewer, active_job=jobs.active_job_for(p)))


# ---------------------------------------------------------------- E9


@api_view(["POST"])
def reanalyze(request, proposal_id):
    # Only meaningful while the scene is missing or the last scene job failed
    # (review-notes fix #4); never re-runs analysis on a healthy scene.
    p, viewer = get_owned_proposal(request, proposal_id)
    data = request.data or {}
    check_revision(p, data.get("expectedRevision"))
    ensure_no_active_job(p)
    last_scene = p.jobs.filter(kind="scene").order_by("-created_at").first()
    if p.scene is not None and not (last_scene and last_scene.status == "failed"):
        raise ApiError("INVALID_STATE", "Scene analysis already exists.")
    jobs.check_scene_provider()  # 503 PROVIDER_UNAVAILABLE when unreachable
    job = jobs.enqueue("scene", p)
    return Response({"jobId": str(job.id), "proposalId": str(p.id)}, status=http_status.HTTP_202_ACCEPTED)


# ---------------------------------------------------------------- E10


@api_view(["POST"])
def save_mask(request, proposal_id):
    p, viewer = get_owned_proposal(request, proposal_id)
    is_multipart = request.content_type.startswith("multipart/")
    if is_multipart:
        expected = request.data.get("expectedRevision")
        mask_file = request.data.get("mask")
        if mask_file is None:
            raise _field_errors(mask=["Mask PNG is required."])
    else:
        data = request.data or {}
        expected = data.get("expectedRevision")
        mask_file = None
    check_revision(p, expected)
    ensure_no_active_job(p)

    with transaction.atomic():
        p = Proposal.objects.select_for_update().get(pk=p.pk)
        if p.status not in ("draft", "ready"):
            raise ApiError("INVALID_STATE")
        if is_multipart:
            rel_path, _cov = validate_png_mask(mask_file, p.source.width, p.source.height)
        else:
            strokes = (request.data or {}).get("strokes")
            rel_path, _cov = rasterize_strokes(strokes or {}, p.source.width, p.source.height)
        asset = Asset.objects.create(
            proposal=p,
            owner=viewer,
            kind="mask",
            file_path=rel_path,
            mime_type="image/png",
            width=p.source.width,
            height=p.source.height,
            sha256="",
        )
        p.mask = asset
        if p.status == "ready":
            p.status = "draft"
        p.revision += 1
        p.save()
    events.record("mask_saved", proposal_id=str(p.id), user_id=str(viewer.id))
    return Response({"assetId": str(asset.id), "revision": p.revision}, status=http_status.HTTP_201_CREATED)


# ---------------------------------------------------------------- E11


@api_view(["POST"])
def request_preview(request, proposal_id):
    p, viewer = get_owned_proposal(request, proposal_id)
    data = request.data or {}
    option_id = data.get("optionId")
    mask_asset_id = data.get("maskAssetId")
    field_errors: dict[str, list[str]] = {}
    if not option_id:
        field_errors["optionId"] = ["This field is required."]
    if not mask_asset_id:
        field_errors["maskAssetId"] = ["This field is required."]
    if field_errors:
        raise ApiError("VALIDATION_ERROR", field_errors=field_errors)
    check_revision(p, data.get("expectedRevision"))

    if not p.scene:
        raise ApiError("VALIDATION_ERROR", field_errors={"optionId": ["Scene analysis is not ready yet."]})
    option_ids = {o.get("id") for o in p.scene.get("options", [])}
    if option_id not in option_ids:
        raise ApiError("VALIDATION_ERROR", field_errors={"optionId": ["Unknown option for this scene."]})
    if not p.mask_id or str(p.mask_id) != str(mask_asset_id):
        raise ApiError("VALIDATION_ERROR", field_errors={"maskAssetId": ["Mask does not match the saved mask."]})

    idem_key = request.headers.get("Idempotency-Key")
    # Same key → return the original job even while it is still active (§5.1).
    existing = jobs.find_by_idempotency_key(p, idem_key)
    if existing is not None:
        return Response(
            {"jobId": str(existing.id), "proposalId": str(p.id)},
            status=http_status.HTTP_202_ACCEPTED,
        )
    ensure_no_active_job(p)
    with transaction.atomic():
        p = Proposal.objects.select_for_update().get(pk=p.pk)
        if p.status not in ("draft", "ready"):
            raise ApiError("INVALID_STATE")
        # Re-check inside the txn: a concurrent request may have enqueued first.
        existing = jobs.find_by_idempotency_key(p, idem_key)
        if existing is not None:
            job = existing
        else:
            job = jobs.enqueue("preview", p, {"optionId": option_id, "maskAssetId": str(mask_asset_id)}, idem_key)
            p.status = "draft"  # no revision bump on enqueue (§5.5)
            p.save(update_fields=["status", "updated_at"])
    return Response({"jobId": str(job.id), "proposalId": str(p.id)}, status=http_status.HTTP_202_ACCEPTED)


# ---------------------------------------------------------------- E13


@api_view(["POST"])
def publish(request, proposal_id):
    p, viewer = get_owned_proposal(request, proposal_id, statuses=("ready",))
    data = request.data or {}
    check_revision(p, data.get("expectedRevision"))
    ensure_no_active_job(p)

    approve_text = data.get("approveText")
    approve_concept = data.get("approveConcept")
    ack_ids = data.get("acknowledgedFlagIds")
    if approve_text is None or approve_concept is None or ack_ids is None:
        raise _field_errors(
            **{
                k: ["This field is required."]
                for k, v in {
                    "approveText": approve_text,
                    "approveConcept": approve_concept,
                    "acknowledgedFlagIds": ack_ids,
                }.items()
                if v is None
            }
        )
    if approve_text is not True or approve_concept is not True:
        raise ApiError("APPROVAL_REQUIRED")
    if not isinstance(ack_ids, list):
        raise _field_errors(acknowledgedFlagIds=["Must be a list of flag ids."])

    review = p.review or {}
    if review.get("verdict") == "blocked":
        raise ApiError("REVIEW_BLOCKED")
    warnings = [f for f in review.get("flags", []) if f.get("severity") == "warning"]
    missing = [f.get("id") for f in warnings if f.get("id") not in (ack_ids or [])]
    if missing:
        raise ApiError("FLAGS_NOT_ACKNOWLEDGED")

    with transaction.atomic():
        p = Proposal.objects.select_for_update().get(pk=p.pk)
        if p.status != "ready":
            raise ApiError("INVALID_STATE")
        p.status = "published"
        p.published_at = timezone.now()
        p.revision += 1
        p.save()
    events.record("published", proposal_id=str(p.id), user_id=str(viewer.id))
    p, viewer = get_visible_proposal(request, proposal_id)
    return Response(serializers.proposal_dict(p, viewer))
