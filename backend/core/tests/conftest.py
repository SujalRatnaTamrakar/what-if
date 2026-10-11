"""Shared test fixtures and helpers."""
from __future__ import annotations

import io
import json
from pathlib import Path

import pytest
import yaml
from django.core.files.uploadedfile import SimpleUploadedFile
from jsonschema import Draft202012Validator
from PIL import Image
from rest_framework.test import APIClient


def make_image(w=800, h=1200, color=(120, 160, 200), fmt="JPEG"):
    img = Image.new("RGB", (w, h), color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    buf.seek(0)
    return SimpleUploadedFile(f"photo.{fmt.lower()}", buf.read(), content_type=f"image/{fmt.lower()}")


def dev_headers(name: str) -> dict:
    return {"HTTP_X_DEV_USER": name}


@pytest.fixture(autouse=True)
def _dev_env_for_tests(settings):
    """Tests simulate the dev environment: DEBUG on + dev-auth bypass on.

    (Django's test runner forces DEBUG=False; without this the X-Dev-User
    bypass in core.auth would be inert and every dev-auth test would 401.)
    """
    settings.DEBUG = True
    settings.AUTH_DEV_BYPASS = True


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def alice_h():
    return dev_headers("alice")


@pytest.fixture
def bob_h():
    return dev_headers("bob")


def create_proposal(client, headers, **kw):
    """POST E5; returns (proposal_dict, job_id)."""
    data = {
        "photo": make_image(**kw.get("image_kw", {})),
        "placeLabel": kw.get("placeLabel", "MARTA stop, Ponce de Leon Ave & N Highland"),
        "problemText": kw.get("problemText", "No shade while waiting in the afternoon sun."),
        "category": "shade",
        "consent": "true",
    }
    resp = client.post("/api/v1/proposals", data, format="multipart", **headers)
    assert resp.status_code == 201, resp.content[:500]
    body = resp.json()
    return body["proposal"], body["jobId"]


def run_full_loop_to_ready(client, headers):
    """Drive create → scene → mask → preview synchronously. Returns (proposal, ids)."""
    from core.models import Job, Proposal
    from core.services.pipeline import run_preview_job, run_scene_job

    proposal, scene_job_id = create_proposal(client, headers)
    pid = proposal["id"]

    job = Job.objects.get(pk=scene_job_id)
    run_scene_job(job)
    job.refresh_from_db()
    assert job.status == "succeeded", job.error

    # pick first option
    resp = client.get(f"/api/v1/proposals/{pid}", **headers)
    assert resp.status_code == 200
    p = resp.json()
    option_id = p["scene"]["options"][0]["id"]
    rev = p["revision"]

    resp = client.patch(
        f"/api/v1/proposals/{pid}",
        {"expectedRevision": rev, "selectedOptionId": option_id},
        format="json",
        **headers,
    )
    assert resp.status_code == 200, resp.content[:300]
    rev = resp.json()["revision"]

    strokes = {"version": 1, "strokes": [{"mode": "paint", "width": 0.05, "points": [[0.3, 0.3], [0.5, 0.35], [0.7, 0.3]]}]}
    resp = client.post(
        f"/api/v1/proposals/{pid}/mask",
        {"expectedRevision": rev, "strokes": strokes},
        format="json",
        **headers,
    )
    assert resp.status_code == 201, resp.content[:300]
    mask_asset_id = resp.json()["assetId"]
    rev = resp.json()["revision"]

    resp = client.post(
        f"/api/v1/proposals/{pid}/preview",
        {"optionId": option_id, "maskAssetId": mask_asset_id, "expectedRevision": rev},
        format="json",
        HTTP_IDEMPOTENCY_KEY="test-key-1",
        **headers,
    )
    assert resp.status_code == 202, resp.content[:300]
    preview_job_id = resp.json()["jobId"]

    job = Job.objects.get(pk=preview_job_id)
    run_preview_job(job)
    job.refresh_from_db()
    assert job.status == "succeeded", job.error

    resp = client.get(f"/api/v1/proposals/{pid}", **headers)
    p = resp.json()
    assert p["status"] == "ready", p["status"]
    return p, {"option_id": option_id, "mask_asset_id": mask_asset_id}


# --- OpenAPI contract validation -------------------------------------------

_SPEC = None


def _spec():
    global _SPEC
    if _SPEC is None:
        path = Path(__file__).resolve().parent.parent.parent.parent / "shared" / "contract" / "openapi.yaml"
        _SPEC = yaml.safe_load(path.read_text())
    return _SPEC


def _resolve(node, _seen=()):
    if isinstance(node, dict):
        if set(node.keys()) == {"$ref"}:
            name = node["$ref"].split("/")[-1]
            assert name not in _seen, f"circular $ref: {name}"
            return _resolve(_SPEC["components"]["schemas"][name], _seen + (name,))
        return {k: _resolve(v, _seen) for k, v in node.items()}
    if isinstance(node, list):
        return [_resolve(v, _seen) for v in node]
    return node


def assert_valid(schema_name: str, data: dict):
    _spec()
    schema = _resolve(_SPEC["components"]["schemas"][schema_name])
    Draft202012Validator(schema).validate(data)
