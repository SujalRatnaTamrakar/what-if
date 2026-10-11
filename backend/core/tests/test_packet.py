"""Packet PDF tests — §9.6: exists, one page, contains the title text."""
from __future__ import annotations

import re
from pathlib import Path

import pytest
from django.conf import settings

from core.models import Packet

from .conftest import assert_valid, run_full_loop_to_ready

pytestmark = pytest.mark.django_db


def _publish(client, headers, proposal, ack_ids=("f1",)):
    resp = client.post(
        f"/api/v1/proposals/{proposal['id']}/publish",
        {
            "expectedRevision": proposal["revision"],
            "approveText": True,
            "approveConcept": True,
            "acknowledgedFlagIds": list(ack_ids),
        },
        format="json",
        **headers,
    )
    assert resp.status_code == 200
    return resp.json()


def test_packet_export_and_pdf(client, alice_h):
    p, _ = run_full_loop_to_ready(client, alice_h)
    pub = _publish(client, alice_h, p)

    resp = client.post(f"/api/v1/proposals/{pub['id']}/packet", **alice_h)
    assert resp.status_code == 200
    body = resp.json()
    assert_valid("Packet", body)
    assert body["supportCountAtExport"] == 0

    packet = Packet.objects.get()
    full = Path(settings.MEDIA_ROOT) / packet.file_path
    assert full.is_file()

    # Download through the signed URL (E18).
    url = body["url"]
    path = url.split("http://localhost:8000")[1]
    dl = client.get(path)
    assert dl.status_code == 200
    assert dl["Content-Type"] == "application/pdf"
    pdf_bytes = b"".join(dl.streaming_content)
    assert pdf_bytes.startswith(b"%PDF")
    # Exactly one page.
    pages = len(re.findall(rb"/Type\s*/Page[^s]", pdf_bytes))
    assert pages == 1, f"expected 1 page, found {pages}"
    # Text is written uncompressed (pageCompression=0) as literal strings.
    assert b"Shade canopy" in pdf_bytes
    # Honesty footer.
    assert b"AI illustration" in pdf_bytes


def test_packet_requires_published(client, alice_h):
    from .conftest import create_proposal

    proposal, _ = create_proposal(client, alice_h)
    resp = client.post(f"/api/v1/proposals/{proposal['id']}/packet", **alice_h)
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INVALID_STATE"


def test_packet_pdf_bad_signature_403(client, alice_h):
    p, _ = run_full_loop_to_ready(client, alice_h)
    pub = _publish(client, alice_h, p)
    resp = client.post(f"/api/v1/proposals/{pub['id']}/packet", **alice_h)
    url = resp.json()["url"]
    path = url.split("http://localhost:8000")[1]
    bad = re.sub(r"sig=[0-9a-f]+", "sig=" + "1" * 64, path)
    r = client.get(bad)
    assert r.status_code == 403
