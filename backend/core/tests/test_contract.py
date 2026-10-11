"""Contract-shape tests — every key response validates against openapi.yaml."""
from __future__ import annotations

import pytest

from core.models import Job
from core.services.pipeline import run_scene_job

from .conftest import assert_valid, create_proposal, run_full_loop_to_ready

pytestmark = pytest.mark.django_db


def test_e1_health_shape(client):
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    assert_valid("HealthResponse", resp.json())


def test_e2_config_shape(client):
    resp = client.get("/api/v1/config")
    assert resp.status_code == 200
    assert_valid("PublicConfig", resp.json())
    assert resp.json()["providers"] == {"scene": "fake", "render": "fake", "review": "fake"}


def test_e3_me_shape(client, alice_h):
    resp = client.get("/api/v1/me", **alice_h)
    assert_valid("Me", resp.json())


def test_e4_update_me_shape(client, alice_h):
    resp = client.patch("/api/v1/me", {"displayName": "New Name"}, format="json", **alice_h)
    assert resp.status_code == 200
    assert_valid("Me", resp.json())
    assert resp.json()["displayName"] == "New Name"

    bad = client.patch("/api/v1/me", {"displayName": ""}, format="json", **alice_h)
    assert bad.status_code == 400
    assert_valid("ErrorBody", bad.json())


def test_e5_create_response_shape(client, alice_h):
    proposal, job_id = create_proposal(client, alice_h)
    assert_valid("Proposal", proposal)
    assert isinstance(job_id, str)


def test_e12_job_shape(client, alice_h):
    _proposal, job_id = create_proposal(client, alice_h)
    resp = client.get(f"/api/v1/jobs/{job_id}", **alice_h)
    assert resp.status_code == 200
    assert_valid("Job", resp.json())


def test_e9_reanalyze_shape(client, alice_h):
    proposal, job_id = create_proposal(client, alice_h)
    job = Job.objects.get(pk=job_id)
    job.status = "failed"
    job.error = {"code": "PROVIDER_TIMEOUT", "message": "x", "retryable": True}
    job.save()
    resp = client.post(
        f"/api/v1/proposals/{proposal['id']}/analyze",
        {"expectedRevision": 1},
        format="json",
        **alice_h,
    )
    assert resp.status_code == 202, resp.content[:300]
    assert_valid("JobAccepted", resp.json())


def test_e9_rejected_when_scene_healthy(client, alice_h):
    proposal, job_id = create_proposal(client, alice_h)
    run_scene_job(Job.objects.get(pk=job_id))
    resp = client.post(
        f"/api/v1/proposals/{proposal['id']}/analyze",
        {"expectedRevision": 2},
        format="json",
        **alice_h,
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INVALID_STATE"


def test_e19_stats_shape(client, alice_h):
    resp = client.get("/api/v1/stats")
    assert resp.status_code == 200
    assert_valid("StatsResponse", resp.json())


def test_error_bodies_match_contract(client):
    resp = client.get("/api/v1/me")
    assert_valid("ErrorBody", resp.json())
    resp = client.get("/api/v1/proposals/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404
    assert_valid("ErrorBody", resp.json())


def test_full_ready_proposal_shape(client, alice_h):
    p, _ = run_full_loop_to_ready(client, alice_h)
    assert_valid("Proposal", p)
    assert_valid("Scene", p["scene"])
    assert_valid("Review", p["review"])
    assert_valid("Generation", p["generation"])
    assert_valid("Asset", p["source"])
    assert_valid("Asset", p["concept"])
