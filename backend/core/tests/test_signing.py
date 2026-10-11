from urllib.parse import parse_qs, urlparse
from uuid import uuid4

from django.test import TestCase, override_settings
from common.http import ApiError
from core.models import Asset, AssetKind
from core.services.signing import signed_url, verify_signature


class SigningServiceTests(TestCase):
    @override_settings(
        PUBLIC_BASE_URL="https://whatif.example",
        MEDIA_URL_TTL_SECONDS=300,
        SECRET_KEY="test-secret",
    )
    def test_signed_url_contains_verifiable_expiration_and_signature(self):
        asset = Asset(id=uuid4(), kind=AssetKind.SOURCE)

        url = signed_url(asset, now=1_000)
        parsed = urlparse(url)
        query = parse_qs(parsed.query)

        self.assertEqual(
            parsed.path,
            f"/api/v1/media/{asset.id}",
        )
        self.assertEqual(query["exp"], ["1300"])
        self.assertEqual(len(query["sig"][0]), 64)
        verify_signature(
            str(asset.id),
            query["exp"][0],
            query["sig"][0],
            now=1_000,
        )

    @override_settings(SECRET_KEY="test-secret")
    def test_verify_signature_rejects_tampered_signature(self):
        with self.assertRaises(ApiError) as raised:
            verify_signature(str(uuid4()), "1000", "bad", now=900)

        self.assertEqual(raised.exception.code, "SIGNATURE_INVALID")
        self.assertEqual(raised.exception.status_code, 403)

    @override_settings(SECRET_KEY="test-secret")
    def test_verify_signature_rejects_expired_url(self):
        with self.assertRaises(ApiError) as raised:
            verify_signature(str(uuid4()), "1000", "anything", now=1001)

        self.assertEqual(raised.exception.code, "SIGNATURE_INVALID")

    @override_settings(SECRET_KEY="test-secret")
    def test_verify_signature_rejects_invalid_expiration(self):
        with self.assertRaises(ApiError) as raised:
            verify_signature(str(uuid4()), "not-a-timestamp", "anything", now=1000)

        self.assertEqual(raised.exception.code, "SIGNATURE_INVALID")

    def test_signed_url_rejects_mask_assets(self):
        asset = Asset(id=uuid4(), kind=AssetKind.MASK)

        with self.assertRaises(ApiError) as raised:
            signed_url(asset, now=1_000)

        self.assertEqual(raised.exception.code, "SIGNATURE_INVALID")
