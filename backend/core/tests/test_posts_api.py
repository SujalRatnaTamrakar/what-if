from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.test import override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APITestCase

from core.models import Asset, Event, Post


class CreatePostApiTests(APITestCase):
    def setUp(self):
        self.media_directory = TemporaryDirectory()
        self.addCleanup(self.media_directory.cleanup)
        self.media_settings = override_settings(
            DEBUG=True,
            AUTH_DEV_BYPASS=True,
            MEDIA_ROOT=Path(self.media_directory.name),
            PUBLIC_BASE_URL="http://testserver",
            SECRET_KEY="posts-api-secret",
        )
        self.media_settings.enable()
        self.addCleanup(self.media_settings.disable)

    def _photo(self, image_format: str = "JPEG") -> SimpleUploadedFile:
        content = BytesIO()
        Image.new("RGB", (120, 80), "blue").save(content, image_format)
        extension = image_format.lower()
        return SimpleUploadedFile(
            f"source.{extension}",
            content.getvalue(),
            content_type=f"image/{extension}",
        )

    def test_create_post_sanitizes_image_and_returns_post(self):
        response = self.client.post(
            "/api/v1/posts",
            {
                "photo": self._photo(),
                "placeLabel": "  Atlanta  ",
                "lat": "33.772456",
                "lng": "-84.366789",
                "locationSource": "gps",
                "locationAccuracyM": "12.5",
                "consent": "true",
            },
            format="multipart",
            HTTP_X_DEV_USER="post-creator",
        )

        self.assertEqual(response.status_code, 201)
        body = response.json()
        post = Post.objects.get()
        asset = Asset.objects.get()
        self.assertEqual(body["id"], str(post.id))
        self.assertEqual(body["status"], "draft")
        self.assertEqual(body["placeLabel"], "Atlanta")
        self.assertEqual(body["location"]["lat"], 33.772456)
        self.assertEqual(body["location"]["source"], "gps")
        self.assertEqual(getattr(post, "source_id"), asset.id)
        self.assertEqual(asset.file_path, f"sources/{asset.file_path.split('/')[-1]}")
        self.assertTrue((Path(self.media_directory.name) / asset.file_path).exists())
        self.assertEqual(Event.objects.filter(type="post_created").count(), 1)

    def test_create_post_requires_authentication(self):
        response = self.client.post(
            "/api/v1/posts",
            {"photo": self._photo(), "consent": "true"},
            format="multipart",
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "AUTH_REQUIRED")

    def test_create_post_requires_consent(self):
        response = self.client.post(
            "/api/v1/posts",
            {"photo": self._photo(), "consent": "false"},
            format="multipart",
            HTTP_X_DEV_USER="post-creator",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "CONSENT_REQUIRED")
        self.assertFalse(Post.objects.exists())

    def test_create_post_rejects_invalid_coordinates(self):
        response = self.client.post(
            "/api/v1/posts",
            {
                "photo": self._photo(),
                "consent": "true",
                "lat": "200",
                "lng": "-84",
                "locationSource": "gps",
            },
            format="multipart",
            HTTP_X_DEV_USER="post-creator",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "VALIDATION_ERROR")
        self.assertFalse(Post.objects.exists())

    def test_create_post_rejects_missing_photo(self):
        response = self.client.post(
            "/api/v1/posts",
            {"consent": "true"},
            format="multipart",
            HTTP_X_DEV_USER="post-creator",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "VALIDATION_ERROR")

    def test_create_post_rejects_oversized_place_label(self):
        response = self.client.post(
            "/api/v1/posts",
            {
                "photo": self._photo(),
                "placeLabel": "x" * 121,
                "consent": "true",
            },
            format="multipart",
            HTTP_X_DEV_USER="post-creator",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "VALIDATION_ERROR")
