import hashlib
import hmac
import time
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any, cast
from urllib.parse import parse_qs, urlparse

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from core.models import Asset, AssetKind, Post
from core.services.signing import signed_url


User = get_user_model()


class MediaViewTests(APITestCase):
    def setUp(self):
        self.media_directory = TemporaryDirectory()
        self.addCleanup(self.media_directory.cleanup)
        self.override_media = override_settings(
            MEDIA_ROOT=Path(self.media_directory.name),
            SECRET_KEY="media-test-secret",
            PUBLIC_BASE_URL="http://testserver",
        )
        self.override_media.enable()
        self.addCleanup(self.override_media.disable)

        self.owner = getattr(User.objects, "create_user")(
            auth0_sub="dev|media-owner",
            display_name="Media Owner",
        )
        self.other_user = getattr(User.objects, "create_user")(
            auth0_sub="dev|media-other",
            display_name="Other User",
        )
        self.source = Asset.objects.create(
            owner=self.owner,
            kind=AssetKind.SOURCE,
            file_path="sources/source.jpg",
            mime_type="image/jpeg",
            width=10,
            height=10,
            sha256="a" * 64,
        )
        self.source_path = Path(self.media_directory.name) / self.source.file_path
        self.source_path.parent.mkdir(parents=True)
        self.source_path.write_bytes(b"source-image")

        self.post = Post.objects.create(
            owner=self.owner,
            source=self.source,
            consent_at="2026-01-01T00:00:00Z",
        )
        self.mask = Asset.objects.create(
            owner=self.owner,
            post=self.post,
            kind=AssetKind.MASK,
            file_path="masks/mask.jpg",
            mime_type="image/jpeg",
            width=10,
            height=10,
            sha256="b" * 64,
        )
        mask_path = Path(self.media_directory.name) / self.mask.file_path
        mask_path.parent.mkdir(parents=True)
        mask_path.write_bytes(b"mask-image")

    def _signed_query(self, asset):
        parsed = urlparse(signed_url(asset, now=int(time.time())))
        return parse_qs(parsed.query)

    def test_valid_signed_url_returns_file(self):
        query = self._signed_query(self.source)

        response = self.client.get(
            f"/api/v1/media/{self.source.id}",
            query,
        )

        self.assertEqual(response.status_code, 200)
        streaming_response = cast(Any, response)
        self.assertEqual(
            b"".join(streaming_response.streaming_content),
            b"source-image",
        )
        self.assertEqual(response["Content-Type"], "image/jpeg")
        self.assertEqual(response["Cache-Control"], "private, max-age=300")

    def test_invalid_signature_returns_standard_403(self):
        response = self.client.get(
            f"/api/v1/media/{self.source.id}",
            {"exp": "4102444800", "sig": "invalid"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "SIGNATURE_INVALID")

    def test_missing_asset_returns_404(self):
        response = self.client.get(
            "/api/v1/media/00000000-0000-0000-0000-000000000000",
            {"exp": "4102444800", "sig": "invalid"},
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "NOT_FOUND")

    @override_settings(DEBUG=True, AUTH_DEV_BYPASS=True)
    def test_mask_requires_the_post_owner(self):
        expiration = 4102444800
        message = f"{self.mask.id}:{expiration}".encode()
        signature = hmac.new(
            b"media-test-secret",
            message,
            hashlib.sha256,
        ).hexdigest()
        query = {"exp": expiration, "sig": signature}

        anonymous_response = self.client.get(
            f"/api/v1/media/{self.mask.id}",
            query,
        )
        self.assertEqual(anonymous_response.status_code, 403)

        other_response = self.client.get(
            f"/api/v1/media/{self.mask.id}",
            query,
            HTTP_X_DEV_USER="other-media-user",
        )
        self.assertEqual(other_response.status_code, 403)

        owner_response = self.client.get(
            f"/api/v1/media/{self.mask.id}",
            query,
            HTTP_X_DEV_USER="media-owner",
        )
        self.assertEqual(owner_response.status_code, 200)
        streaming_owner_response = cast(Any, owner_response)
        self.assertEqual(
            b"".join(streaming_owner_response.streaming_content),
            b"mask-image",
        )

    def test_file_path_outside_media_root_returns_404(self):
        self.source.file_path = "../outside.jpg"
        self.source.save(update_fields=["file_path"])
        outside_path = Path(self.media_directory.name).parent / "outside.jpg"
        outside_path.write_bytes(b"secret")
        self.addCleanup(outside_path.unlink, missing_ok=True)
        query = self._signed_query(self.source)

        response = self.client.get(
            f"/api/v1/media/{self.source.id}",
            query,
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "NOT_FOUND")
