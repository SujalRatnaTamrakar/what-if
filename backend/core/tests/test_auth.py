"""Auth tests — §9.6: valid/wrong-audience/expired tokens, dev bypass, 404-not-403."""
from __future__ import annotations

import json
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from django.test import override_settings

from core.models import Job

from .conftest import assert_valid, create_proposal, dev_headers

pytestmark = pytest.mark.django_db


def _keypair():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pub_jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))
    pub_jwk["kid"] = "testkid"
    return key, pub_jwk


def _token(key, sub="auth0|tester", aud="https://api.whatif.dev", exp_in=3600):
    now = int(time.time())
    return jwt.encode(
        {
            "sub": sub,
            "aud": aud,
            "iss": "https://whatif.us.auth0.com/",
            "iat": now - 10,
            "exp": now + exp_in,
        },
        key,
        algorithm="RS256",
        headers={"kid": "testkid"},
    )


@pytest.fixture
def jwt_env(monkeypatch):
    key, pub_jwk = _keypair()
    monkeypatch.setattr("core.auth._jwks_keys", lambda domain, kid, _force_refresh=False: pub_jwk)
    return key


@override_settings(AUTH0_DOMAIN="whatif.us.auth0.com", AUTH0_AUDIENCE="https://api.whatif.dev")
def test_jwt_valid_creates_user(client, jwt_env):
    token = _token(jwt_env)
    resp = client.get("/api/v1/me", HTTP_AUTHORIZATION=f"Bearer {token}")
    assert resp.status_code == 200, resp.content[:300]
    body = resp.json()
    assert_valid("Me", body)
    assert body["displayName"].startswith("Neighbor-")


@override_settings(AUTH0_DOMAIN="whatif.us.auth0.com", AUTH0_AUDIENCE="https://api.whatif.dev")
def test_jwt_wrong_audience_rejected(client, jwt_env):
    token = _token(jwt_env, aud="https://evil.example")
    resp = client.get("/api/v1/me", HTTP_AUTHORIZATION=f"Bearer {token}")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "AUTH_REQUIRED"


@override_settings(AUTH0_DOMAIN="whatif.us.auth0.com", AUTH0_AUDIENCE="https://api.whatif.dev")
def test_jwt_expired_rejected(client, jwt_env):
    token = _token(jwt_env, exp_in=-60)
    resp = client.get("/api/v1/me", HTTP_AUTHORIZATION=f"Bearer {token}")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "AUTH_REQUIRED"


def test_protected_route_401_without_token(client):
    resp = client.get("/api/v1/me")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "AUTH_REQUIRED"


def test_dev_bypass_header(client):
    resp = client.get("/api/v1/me", **dev_headers("carol"))
    assert resp.status_code == 200
    assert resp.json()["displayName"] == "carol"


def test_user_b_cannot_read_user_a_draft(client, alice_h, bob_h):
    proposal, _job_id = create_proposal(client, alice_h)
    resp = client.get(f"/api/v1/proposals/{proposal['id']}", **bob_h)
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


def test_user_b_cannot_read_user_a_job(client, alice_h, bob_h):
    _proposal, job_id = create_proposal(client, alice_h)
    resp = client.get(f"/api/v1/jobs/{job_id}", **bob_h)
    assert resp.status_code == 404


def test_media_without_signature_is_403(client, alice_h):
    proposal, _job_id = create_proposal(client, alice_h)
    asset_id = proposal["source"]["id"]
    resp = client.get(f"/api/v1/media/{asset_id}")
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "SIGNATURE_INVALID"


def test_media_with_valid_signature_serves_bytes(client, alice_h):
    proposal, _job_id = create_proposal(client, alice_h)
    url = proposal["source"]["url"]
    path = url.split("http://localhost:8000")[1]
    resp = client.get(path)
    assert resp.status_code == 200
    assert resp["Cache-Control"] == "private, max-age=300"
    assert resp["Content-Type"] == "image/jpeg"


def test_media_with_tampered_signature_is_403(client, alice_h):
    proposal, _job_id = create_proposal(client, alice_h)
    url = proposal["source"]["url"]
    path = url.split("http://localhost:8000")[1]
    tampered = path.replace("sig=", "sig=deadbeef") if "sig=deadbeef" not in path else path + "x"
    # ensure the sig param value is actually changed
    import re

    tampered = re.sub(r"sig=[0-9a-f]+", "sig=" + "0" * 64, path)
    resp = client.get(tampered)
    assert resp.status_code == 403
