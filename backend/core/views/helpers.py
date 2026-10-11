"""Shared view helpers."""
from __future__ import annotations

import base64
import json

from core.exceptions import ApiError
from core.models import Proposal
from core.permissions import try_auth
from core.services import jobs


def get_visible_proposal(request, proposal_id) -> tuple[Proposal, object | None]:
    """E7 rule: published → anyone; otherwise owner only. Never 403 — 404."""
    viewer = try_auth(request)
    try:
        p = (
            Proposal.objects.select_related("owner", "source", "concept", "mask")
            .get(pk=proposal_id)
        )
    except Proposal.DoesNotExist:
        raise ApiError("NOT_FOUND", "Not found or not yours.")
    if p.status == "published":
        return p, viewer
    if viewer is None or str(viewer.id) != str(p.owner_id):
        raise ApiError("NOT_FOUND", "Not found or not yours.")
    return p, viewer


def get_owned_proposal(request, proposal_id, *, statuses=("draft", "ready")) -> tuple[Proposal, object]:
    """Owner-only access for draft/ready mutations. 404 when not the owner."""
    from core.permissions import require_auth

    viewer = require_auth(request)
    try:
        p = (
            Proposal.objects.select_related("owner", "source", "concept", "mask")
            .get(pk=proposal_id, owner=viewer)
        )
    except Proposal.DoesNotExist:
        raise ApiError("NOT_FOUND", "Not found or not yours.")
    if statuses and p.status not in statuses:
        raise ApiError("INVALID_STATE")
    return p, viewer


def check_revision(proposal: Proposal, expected) -> None:
    if expected is None:
        raise ApiError("VALIDATION_ERROR", field_errors={"expectedRevision": ["This field is required."]})
    try:
        expected_int = int(expected)
    except (TypeError, ValueError):
        raise ApiError("VALIDATION_ERROR", field_errors={"expectedRevision": ["Must be an integer."]})
    if expected_int != proposal.revision:
        raise ApiError("REVISION_CONFLICT")


def ensure_no_active_job(proposal: Proposal) -> None:
    if jobs.active_job_for(proposal) is not None:
        raise ApiError("JOB_IN_PROGRESS")


def encode_cursor(ts_iso: str, obj_id: str) -> str:
    raw = json.dumps({"t": ts_iso, "id": obj_id}).encode()
    return base64.urlsafe_b64encode(raw).decode()


def decode_cursor(cursor: str):
    try:
        data = json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())
        return data["t"], data["id"]
    except Exception:
        raise ApiError("VALIDATION_ERROR", field_errors={"cursor": ["Invalid cursor."]})
