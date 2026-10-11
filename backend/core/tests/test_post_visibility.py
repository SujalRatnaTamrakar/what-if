from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from core.models import Asset, AssetKind, Post, PostStatus


User = get_user_model()


class PostVisibilityApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.media_directory = TemporaryDirectory()
        self.addCleanup(self.media_directory.cleanup)
        self.settings_override = override_settings(
            DEBUG=True,
            AUTH_DEV_BYPASS=True,
            SECRET_KEY="visibility-secret",
            PUBLIC_BASE_URL="http://testserver",
            MEDIA_ROOT=Path(self.media_directory.name),
        )
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)

        self.owner = getattr(User.objects, "create_user")(
            auth0_sub="dev|visibility-owner",
            display_name="Owner",
        )
        self.other_user = getattr(User.objects, "create_user")(
            auth0_sub="dev|visibility-other",
            display_name="Other",
        )
        source = Asset.objects.create(
            owner=self.owner,
            kind=AssetKind.SOURCE,
            file_path="sources/source.jpg",
            mime_type="image/jpeg",
            width=100,
            height=100,
            sha256="a" * 64,
        )
        source_path = Path(self.media_directory.name) / source.file_path
        source_path.parent.mkdir(parents=True)
        source_path.write_bytes(b"source")
        self.post = Post.objects.create(
            owner=self.owner,
            source=source,
            place_label="Atlanta",
            lat=33.772456,
            lng=-84.366789,
            location_source="gps",
            consent_at=datetime.now(timezone.utc),
        )

    def test_owner_can_view_draft(self):
        response = self.client.get(
            f"/api/v1/posts/{self.post.id}",
            HTTP_X_DEV_USER="visibility-owner",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], str(self.post.id))
        self.assertEqual(response.json()["location"]["lat"], 33.772456)

    def test_other_user_cannot_view_draft(self):
        response = self.client.get(
            f"/api/v1/posts/{self.post.id}",
            HTTP_X_DEV_USER="visibility-other",
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "NOT_FOUND")

    def test_anonymous_user_cannot_view_draft(self):
        response = self.client.get(f"/api/v1/posts/{self.post.id}")

        self.assertEqual(response.status_code, 404)

    def test_published_post_is_public(self):
        self.post.status = PostStatus.PUBLISHED
        self.post.save(update_fields=["status"])

        response = self.client.get(f"/api/v1/posts/{self.post.id}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["location"]["lat"], 33.772)

    def test_removed_post_is_hidden_from_owner(self):
        self.post.status = PostStatus.REMOVED
        self.post.save(update_fields=["status"])

        response = self.client.get(
            f"/api/v1/posts/{self.post.id}",
            HTTP_X_DEV_USER="visibility-owner",
        )

        self.assertEqual(response.status_code, 404)

    def test_distance_uses_viewer_coordinates(self):
        self.post.status = PostStatus.PUBLISHED
        self.post.save(update_fields=["status"])

        response = self.client.get(
            f"/api/v1/posts/{self.post.id}?lat=33.772&lng=-84.367",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.json()["distanceKm"])

    def test_invalid_viewer_coordinates_return_validation_error(self):
        self.post.status = PostStatus.PUBLISHED
        self.post.save(update_fields=["status"])

        response = self.client.get(
            f"/api/v1/posts/{self.post.id}?lat=not-a-number&lng=-84",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "VALIDATION_ERROR")
