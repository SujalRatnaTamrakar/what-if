"""Publish gate + support idempotency tests — §9.6."""
from __future__ import annotations

import threading

import pytest
from django.utils import timezone

from core.models import Proposal

from .conftest import assert_valid, create_proposal, run_full_loop_to_ready

pytestmark = pytest.mark.django_db


def _publish(client, headers, proposal, ack_ids):
    return client.post(
        f"/api/v1/proposals/{proposal['id']}/publish",
        {
            "expectedRevision": proposal["revision"],
            "approveText": True,
            "approveConcept": True,
            "acknowledgedFlagIds": ack_ids,
        },
        format="json",
        **headers,
    )


def test_publish_gate_blocks_without_acknowledgment(client, alice_h):
    p, _ = run_full_loop_to_ready(client, alice_h)
    resp = _publish(client, alice_h, p, [])
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "FLAGS_NOT_ACKNOWLEDGED"


def test_publish_gate_approval_required(client, alice_h):
    p, _ = run_full_loop_to_ready(client, alice_h)
    resp = client.post(
        f"/api/v1/proposals/{p['id']}/publish",
        {"expectedRevision": p["revision"], "approveText": False,
         "approveConcept": True, "acknowledgedFlagIds": ["f1"]},
        format="json",
        **alice_h,
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "APPROVAL_REQUIRED"


def test_publish_gate_blocked_verdict(client, alice_h):
    p, _ids = run_full_loop_to_ready(client, alice_h)
    obj = Proposal.objects.get(pk=p["id"])
    review = dict(obj.review)
    review["verdict"] = "blocked"
    review["flags"] = [{"id": "f9", "code": "PEOPLE_VISIBLE", "severity": "blocking",
                        "message": "A person is visible in the concept."}]
    obj.review = review
    obj.save(update_fields=["review"])
    resp = _publish(client, alice_h, p, [])
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "REVIEW_BLOCKED"


def test_publish_success(client, alice_h):
    p, _ = run_full_loop_to_ready(client, alice_h)
    resp = _publish(client, alice_h, p, ["f1"])
    assert resp.status_code == 200, resp.content[:300]
    body = resp.json()
    assert_valid("Proposal", body)
    assert body["status"] == "published"
    assert body["publishedAt"] is not None
    assert body["revision"] == p["revision"] + 1


def _publish_direct(client, headers):
    """Shortcut: full loop then publish, returns published proposal dict."""
    p, _ = run_full_loop_to_ready(client, headers)
    resp = _publish(client, headers, p, ["f1"])
    assert resp.status_code == 200
    return resp.json()


def test_support_requires_published(client, alice_h):
    proposal, _ = create_proposal(client, alice_h)
    resp = client.post(f"/api/v1/proposals/{proposal['id']}/support", **alice_h)
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INVALID_STATE"


def test_support_first_and_repeat(client, alice_h):
    p = _publish_direct(client, alice_h)
    r1 = client.post(f"/api/v1/proposals/{p['id']}/support", **alice_h)
    assert r1.status_code == 200
    b1 = r1.json()
    assert_valid("SupportResult", b1)
    assert b1["supportCount"] == 1 and b1["alreadySupported"] is False

    r2 = client.post(f"/api/v1/proposals/{p['id']}/support", **alice_h)
    b2 = r2.json()
    assert b2["supportCount"] == 1 and b2["alreadySupported"] is True


def test_support_third_user_increments(client, alice_h, bob_h):
    p = _publish_direct(client, alice_h)
    client.post(f"/api/v1/proposals/{p['id']}/support", **alice_h)
    r = client.post(f"/api/v1/proposals/{p['id']}/support", **bob_h)
    assert r.json()["supportCount"] == 2


@pytest.mark.django_db(transaction=True)
def test_support_concurrent_same_user_counts_once(client, alice_h):
    """Two simultaneous supports from one user → count 1 (§9.6)."""
    p = _publish_direct(client, alice_h)
    pid = p["id"]
    results = []

    def hit():
        c = __import__("rest_framework.test", fromlist=["APIClient"]).APIClient()
        results.append(c.post(f"/api/v1/proposals/{pid}/support", **alice_h).status_code)

    threads = [threading.Thread(target=hit) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert results == [200, 200]
    obj = Proposal.objects.get(pk=pid)
    assert obj.support_count == 1


def test_public_feed_shows_published(client, alice_h):
    p = _publish_direct(client, alice_h)
    resp = client.get("/api/v1/proposals?scope=public")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    assert_valid("ProposalSummary", items[0])
    assert items[0]["id"] == p["id"]


def test_unsupport(client, alice_h):
    p = _publish_direct(client, alice_h)
    client.post(f"/api/v1/proposals/{p['id']}/support", **alice_h)
    r = client.delete(f"/api/v1/proposals/{p['id']}/support", **alice_h)
    assert r.status_code == 200
    assert r.json()["supportCount"] == 0
    assert r.json()["viewerHasSupported"] is False
