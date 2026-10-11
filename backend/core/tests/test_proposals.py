"""Proposal endpoint tests — E5/E6/E7, validation, revision conflicts."""
from __future__ import annotations

import pytest

from .conftest import assert_valid, create_proposal, make_image

pytestmark = pytest.mark.django_db


def test_e5_create_shape_and_defaults(client, alice_h):
    proposal, job_id = create_proposal(client, alice_h)
    assert_valid("Proposal", proposal)
    assert proposal["revision"] == 1
    assert proposal["status"] == "draft"
    assert proposal["scene"] is None
    assert proposal["concept"] is None
    assert proposal["recipientLabel"] == "To confirm"
    assert proposal["activeJob"]["id"] == job_id
    assert proposal["activeJob"]["kind"] == "scene"
    assert proposal["source"]["width"] == 800
    assert proposal["source"]["height"] == 1200


def test_e5_consent_required(client, alice_h):
    data = {
        "photo": make_image(),
        "placeLabel": "Some place here",
        "problemText": "A problem description that is long enough.",
        "category": "shade",
        "consent": "false",
    }
    resp = client.post("/api/v1/proposals", data, format="multipart", **alice_h)
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "CONSENT_REQUIRED"


def test_e5_field_errors(client, alice_h):
    data = {
        "photo": make_image(),
        "placeLabel": "ab",
        "problemText": "short",
        "category": "shade",
        "consent": "true",
    }
    resp = client.post("/api/v1/proposals", data, format="multipart", **alice_h)
    assert resp.status_code == 400
    err = resp.json()["error"]
    assert err["code"] == "VALIDATION_ERROR"
    assert "placeLabel" in err["fieldErrors"]
    assert "problemText" in err["fieldErrors"]


def test_e5_unsupported_image(client, alice_h):
    from django.core.files.uploadedfile import SimpleUploadedFile

    data = {
        "photo": SimpleUploadedFile("evil.txt", b"not an image", content_type="text/plain"),
        "placeLabel": "Some place here",
        "problemText": "A problem description that is long enough.",
        "category": "shade",
        "consent": "true",
    }
    resp = client.post("/api/v1/proposals", data, format="multipart", **alice_h)
    assert resp.status_code == 415
    assert resp.json()["error"]["code"] == "UNSUPPORTED_IMAGE"


def test_e6_public_empty_and_mine_requires_auth(client, alice_h):
    resp = client.get("/api/v1/proposals?scope=public")
    assert resp.status_code == 200
    assert_valid("ProposalListPage", resp.json())
    assert resp.json()["items"] == []

    resp = client.get("/api/v1/proposals?scope=mine")
    assert resp.status_code == 401

    resp = client.get("/api/v1/proposals?scope=bogus", **alice_h)
    assert resp.status_code == 400


def test_e6_mine_lists_own_drafts(client, alice_h, bob_h):
    create_proposal(client, alice_h)
    resp = client.get("/api/v1/proposals?scope=mine", **alice_h)
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 1
    resp = client.get("/api/v1/proposals?scope=mine", **bob_h)
    assert resp.json()["items"] == []


def test_e8_revision_conflict(client, alice_h):
    proposal, _ = create_proposal(client, alice_h)
    resp = client.patch(
        f"/api/v1/proposals/{proposal['id']}",
        {"expectedRevision": 999, "title": "New title"},
        format="json",
        **alice_h,
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "REVISION_CONFLICT"


def test_e8_patch_bumps_revision_and_sets_user_edited(client, alice_h):
    from core.models import Job
    from core.services.pipeline import run_scene_job

    proposal, job_id = create_proposal(client, alice_h)
    # The scene job is active right after create → E8 must 409 (JOB_IN_PROGRESS).
    busy = client.patch(
        f"/api/v1/proposals/{proposal['id']}",
        {"expectedRevision": 1, "title": "Too early"},
        format="json",
        **alice_h,
    )
    assert busy.status_code == 409
    assert busy.json()["error"]["code"] == "JOB_IN_PROGRESS"

    run_scene_job(Job.objects.get(pk=job_id))
    resp = client.patch(
        f"/api/v1/proposals/{proposal['id']}",
        {"expectedRevision": 2, "title": "My title", "recipientLabel": "City DOT"},
        format="json",
        **alice_h,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert_valid("Proposal", body)
    assert body["revision"] == 3
    assert body["title"] == "My title"
    assert body["recipientLabel"] == "City DOT"


def test_e8_bad_option_rejected(client, alice_h):
    from core.models import Job
    from core.services.pipeline import run_scene_job

    proposal, job_id = create_proposal(client, alice_h)
    run_scene_job(Job.objects.get(pk=job_id))
    resp = client.patch(
        f"/api/v1/proposals/{proposal['id']}",
        {"expectedRevision": 2, "selectedOptionId": "not_a_real_option"},
        format="json",
        **alice_h,
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


def test_e11_idempotency_key_returns_same_job(client, alice_h):
    from core.models import Job
    from core.services.pipeline import run_scene_job

    proposal, job_id = create_proposal(client, alice_h)
    run_scene_job(Job.objects.get(pk=job_id))
    pid = proposal["id"]

    resp = client.get(f"/api/v1/proposals/{pid}", **alice_h)
    p = resp.json()
    option_id = p["scene"]["options"][0]["id"]
    rev = p["revision"]
    resp = client.patch(
        f"/api/v1/proposals/{pid}",
        {"expectedRevision": rev, "selectedOptionId": option_id},
        format="json",
        **alice_h,
    )
    rev = resp.json()["revision"]
    strokes = {"version": 1, "strokes": [{"mode": "paint", "width": 0.05, "points": [[0.3, 0.3], [0.6, 0.3]]}]}
    resp = client.post(
        f"/api/v1/proposals/{pid}/mask",
        {"expectedRevision": rev, "strokes": strokes},
        format="json",
        **alice_h,
    )
    mask_id, rev = resp.json()["assetId"], resp.json()["revision"]

    kw = {"HTTP_IDEMPOTENCY_KEY": "idem-123", **alice_h}
    body = {"optionId": option_id, "maskAssetId": mask_id, "expectedRevision": rev}
    r1 = client.post(f"/api/v1/proposals/{pid}/preview", body, format="json", **kw)
    assert r1.status_code == 202, r1.content[:300]
    # Same key while the job is active → the original job (§5.1).
    r_same = client.post(f"/api/v1/proposals/{pid}/preview", body, format="json", **kw)
    assert r_same.status_code == 202
    assert r_same.json()["jobId"] == r1.json()["jobId"]
    # A different key while a job is active → 409 JOB_IN_PROGRESS.
    r2 = client.post(
        f"/api/v1/proposals/{pid}/preview", body, format="json",
        HTTP_IDEMPOTENCY_KEY="idem-456", **alice_h,
    )
    assert r2.status_code == 409
    assert r2.json()["error"]["code"] == "JOB_IN_PROGRESS"
