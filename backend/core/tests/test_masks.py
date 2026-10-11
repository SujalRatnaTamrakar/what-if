from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APITestCase

from common.http import ApiError
from core.models import Asset, Job, JobStage, JobStatus, Post, PostStatus
from core.services.masks import rasterize_strokes


class MaskServiceTests(TestCase):
    def test_rasterizes_paint_and_erase_strokes(self):
        mask = rasterize_strokes(
            {
                "version": 1,
                "strokes": [
                    {
                        "mode": "paint",
                        "width": 0.2,
                        "points": [[0.2, 0.5], [0.8, 0.5]],
                    },
                    {
                        "mode": "erase",
                        "width": 0.1,
                        "points": [[0.5, 0.5]],
                    },
                ],
            },
            width=100,
            height=100,
        )

        self.assertEqual(mask.mode, "L")
        self.assertEqual(mask.size, (100, 100))
        self.assertEqual(mask.getpixel((20, 50)), 255)
        self.assertEqual(mask.getpixel((50, 50)), 0)

    def test_rejects_empty_strokes(self):
        with self.assertRaises(ApiError) as raised:
            rasterize_strokes(
                {"version": 1, "strokes": []},
                width=100,
                height=100,
            )

        self.assertEqual(raised.exception.code, "MASK_EMPTY")

    def test_rejects_excessive_coverage(self):
        with self.assertRaises(ApiError) as raised:
            rasterize_strokes(
                {
                    "version": 1,
                    "strokes": [
                        {
                            "mode": "paint",
                            "width": 1,
                            "points": [[0, 0], [1, 1]],
                        }
                    ],
                },
                width=100,
                height=100,
            )

        self.assertEqual(raised.exception.code, "MASK_TOO_LARGE")


class SaveMaskApiTests(APITestCase):
    def setUp(self):
        self.media_directory = TemporaryDirectory()
        self.addCleanup(self.media_directory.cleanup)
        self.media_settings = override_settings(
            DEBUG=True,
            AUTH_DEV_BYPASS=True,
            MEDIA_ROOT=Path(self.media_directory.name),
            PUBLIC_BASE_URL="http://testserver",
            SECRET_KEY="mask-api-secret",
        )
        self.media_settings.enable()
        self.addCleanup(self.media_settings.disable)

        response = self.client.post(
            "/api/v1/posts",
            {
                "photo": self._photo(),
                "consent": "true",
            },
            format="multipart",
            HTTP_X_DEV_USER="mask-owner",
        )
        self.assertEqual(response.status_code, 201)
        self.post = Post.objects.get()

    def _photo(self):
        content = BytesIO()
        Image.new("RGB", (120, 80), "blue").save(content, "JPEG")
        from django.core.files.uploadedfile import SimpleUploadedFile

        return SimpleUploadedFile(
            "source.jpg",
            content.getvalue(),
            content_type="image/jpeg",
        )

    def _mask_png(self, color=255):
        content = BytesIO()
        image = Image.new("L", (120, 80), 0)
        if color:
            for x in range(20, 60):
                for y in range(20, 60):
                    image.putpixel((x, y), color)
        image.save(content, "PNG")
        from django.core.files.uploadedfile import SimpleUploadedFile

        return SimpleUploadedFile(
            "mask.png",
            content.getvalue(),
            content_type="image/png",
        )

    def test_saves_rasterized_mask_and_increments_revision(self):
        response = self.client.post(
            f"/api/v1/posts/{self.post.pk}/mask",
            {
                "expectedRevision": 1,
                "strokes": {
                    "version": 1,
                    "strokes": [
                        {
                            "mode": "paint",
                            "width": 0.15,
                            "points": [[0.2, 0.5], [0.8, 0.5]],
                        }
                    ],
                },
            },
            format="json",
            HTTP_X_DEV_USER="mask-owner",
        )

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.post.refresh_from_db()
        mask = Asset.objects.get(pk=body["assetId"])
        self.assertEqual(body["revision"], 2)
        self.assertEqual(self.post.revision, 2)
        self.assertEqual(self.post.status, PostStatus.DRAFT)
        self.assertEqual(mask.kind, "mask")
        self.assertEqual((mask.width, mask.height), (120, 80))
        self.assertTrue((Path(self.media_directory.name) / mask.file_path).exists())
        with Image.open(Path(self.media_directory.name) / mask.file_path) as image:
            self.assertEqual(image.mode, "L")
            self.assertEqual(image.size, (120, 80))

    def test_saves_exact_size_png_mask(self):
        response = self.client.post(
            f"/api/v1/posts/{self.post.pk}/mask",
            {"expectedRevision": 1, "mask": self._mask_png()},
            format="multipart",
            HTTP_X_DEV_USER="mask-owner",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Asset.objects.get(kind="mask").mime_type, "image/png")

    def test_rejects_wrong_revision(self):
        response = self.client.post(
            f"/api/v1/posts/{self.post.pk}/mask",
            {
                "expectedRevision": 2,
                "strokes": {
                    "version": 1,
                    "strokes": [
                        {
                            "mode": "paint",
                            "width": 0.2,
                            "points": [[0.2, 0.5], [0.8, 0.5]],
                        }
                    ],
                },
            },
            format="json",
            HTTP_X_DEV_USER="mask-owner",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "REVISION_CONFLICT")

    def test_rejects_wrong_png_dimensions(self):
        content = BytesIO()
        Image.new("L", (20, 20), 255).save(content, "PNG")
        from django.core.files.uploadedfile import SimpleUploadedFile

        response = self.client.post(
            f"/api/v1/posts/{self.post.pk}/mask",
            {
                "expectedRevision": 1,
                "mask": SimpleUploadedFile(
                    "mask.png",
                    content.getvalue(),
                    content_type="image/png",
                ),
            },
            format="multipart",
            HTTP_X_DEV_USER="mask-owner",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "MASK_SIZE_MISMATCH")

    def test_rejects_active_job(self):
        Job.objects.create(
            post=self.post,
            owner=self.post.owner,
            kind="generate",
            status=JobStatus.RUNNING,
            stage=JobStage.RENDER,
            base_revision=self.post.revision,
        )

        response = self.client.post(
            f"/api/v1/posts/{self.post.pk}/mask",
            {
                "expectedRevision": 1,
                "strokes": {
                    "version": 1,
                    "strokes": [
                        {
                            "mode": "paint",
                            "width": 0.2,
                            "points": [[0.2, 0.5], [0.8, 0.5]],
                        }
                    ],
                },
            },
            format="json",
            HTTP_X_DEV_USER="mask-owner",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "JOB_IN_PROGRESS")
