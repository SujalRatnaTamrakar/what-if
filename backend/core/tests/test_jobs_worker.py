"""Worker + pipeline tests — §9.6: scene apply, STALE_RESULT, lease reclaim."""
from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from core.models import Job, Proposal
from core.services import jobs
from core.services.pipeline import run_preview_job, run_scene_job

from .conftest import assert_valid, create_proposal, run_full_loop_to_ready

pytestmark = pytest.mark.django_db


def test_scene_job_applies_scene_and_bumps_revision(client, alice_h):
    proposal, job_id = create_proposal(client, alice_h)
    job = Job.objects.get(pk=job_id)
    run_scene_job(job)
    job.refresh_from_db()
    assert job.status == "succeeded"
    assert job.stage == "done"
    assert_valid("Job", {
        "id": str(job.id), "proposalId": str(job.proposal_id), "kind": job.kind,
        "status": job.status, "stage": job.stage, "attempt": job.attempt,
        "createdAt": "2026-10-10T17:00:00Z", "updatedAt": "2026-10-10T17:00:00Z",
    })
    p = Proposal.objects.get(pk=proposal["id"])
    assert p.scene is not None
    assert p.scene["options"][0]["id"] == "shade_canopy"
    assert p.revision == 2  # rev 1 → 2 on scene apply


def test_stale_result_discards_and_marks_failed(client, alice_h):
    proposal, job_id = create_proposal(client, alice_h)
    job = Job.objects.get(pk=job_id)
    # Simulate a concurrent PATCH bumping the revision before the worker writes.
    p = Proposal.objects.get(pk=proposal["id"])
    p.revision = 2
    p.save(update_fields=["revision"])
    run_scene_job(job)
    job.refresh_from_db()
    assert job.status == "failed"
    assert job.error["code"] == "STALE_RESULT"
    assert job.error["retryable"] is False
    p.refresh_from_db()
    assert p.scene is None  # result discarded


def test_claim_reclaims_expired_lease(client, alice_h):
    proposal, job_id = create_proposal(client, alice_h)
    job = Job.objects.get(pk=job_id)
    job.status = "running"
    job.attempt = 0
    job.lease_expires_at = timezone.now() - timedelta(seconds=1)
    job.save()
    claimed = jobs.claim()
    assert claimed is not None and str(claimed.id) == str(job.id)
    assert claimed.attempt == 1
    assert claimed.status == "running"


def test_sweep_marks_max_attempts_failed(client, alice_h):
    from django.conf import settings

    proposal, job_id = create_proposal(client, alice_h)
    job = Job.objects.get(pk=job_id)
    job.status = "running"
    job.attempt = settings.JOB_MAX_ATTEMPTS
    job.lease_expires_at = timezone.now() - timedelta(seconds=1)
    job.save()
    assert jobs.claim() is None  # not claimable anymore
    assert jobs.sweep_expired() == 1
    job.refresh_from_db()
    assert job.status == "failed"
    assert job.error["code"] == "PROVIDER_TIMEOUT"


def test_preview_job_end_to_end_sets_ready(client, alice_h):
    p, _ids = run_full_loop_to_ready(client, alice_h)
    assert p["status"] == "ready"
    assert p["concept"] is not None
    assert p["concept"]["width"] == p["source"]["width"]
    assert p["concept"]["height"] == p["source"]["height"]
    assert p["review"]["verdict"] == "needs_review"
    assert p["generation"]["provider"] == "fake"
    assert p["title"]  # draft_request filled the text
    assert_valid("Proposal", p)


def test_review_unavailable_does_not_fail_job(client, alice_h, monkeypatch):
    """A review ProviderError records REVIEW_UNAVAILABLE and the job succeeds."""
    from backend.common.errors import ProviderUnavailable

    proposal, scene_job_id = create_proposal(client, alice_h)
    run_scene_job(Job.objects.get(pk=scene_job_id))
    pid = proposal["id"]

    resp = client.get(f"/api/v1/proposals/{pid}", **alice_h)
    p = resp.json()
    option_id = p["scene"]["options"][0]["id"]
    rev = p["revision"]
    client.patch(f"/api/v1/proposals/{pid}",
                 {"expectedRevision": rev, "selectedOptionId": option_id},
                 format="json", **alice_h)
    strokes = {"version": 1, "strokes": [{"mode": "paint", "width": 0.05, "points": [[0.3, 0.3], [0.6, 0.3]]}]}
    r = client.post(f"/api/v1/proposals/{pid}/mask",
                    {"expectedRevision": rev + 1, "strokes": strokes}, format="json", **alice_h)
    mask_id, rev = r.json()["assetId"], r.json()["revision"]
    r = client.post(f"/api/v1/proposals/{pid}/preview",
                    {"optionId": option_id, "maskAssetId": mask_id, "expectedRevision": rev},
                    format="json", **alice_h)
    preview_job = Job.objects.get(pk=r.json()["jobId"])

    import core.services.pipeline as pipeline

    real_agents = pipeline._agents()[0]

    class ExplodingAgents:
        def __getattr__(self, name):
            if name == "review_concept":
                def _boom(*a, **k):
                    raise ProviderUnavailable("review is down")
                return _boom
            return getattr(real_agents, name)

    monkeypatch.setattr(pipeline, "_agents", lambda: (ExplodingAgents(), True))
    run_preview_job(preview_job)
    preview_job.refresh_from_db()
    assert preview_job.status == "succeeded", preview_job.error
    p = Proposal.objects.get(pk=pid)
    assert p.review["flags"][0]["code"] == "REVIEW_UNAVAILABLE"
    assert p.status == "ready"  # warning is acknowledgable → still publishable
