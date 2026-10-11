from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from core.models import Asset, AssetKind, Post, PostStatus


User = get_user_model()


class GenerationJobApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.media_directory = TemporaryDirectory()
        self.addCleanup(self.media_directory.cleanup)
        self.settings_override = override_settings(
            DEBUG=True,
            AUTH_DEV_BYPASS=True,
            SECRET_KEY="jobs-secret",
            PUBLIC_BASE_URL="http://testserver",
            MEDIA_ROOT=Path(self.media_directory.name),
        )
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)

        self.owner = User.objects.create_user(
            auth0_sub="dev|jobs-owner",
            display_name="Owner",
        )
        self.other_user = User.objects.create_user(
            auth0_sub="dev|jobs-other",
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
        self.mask = Asset.objects.create(
            owner=self.owner,
            kind=AssetKind.MASK,
            file_path="masks/mask.png",
            mime_type="image/png",
            width=100,
            height=100,
            sha256="b" * 64,
        )
        self.post = Post.objects.create(
            owner=self.owner,
            source=source,
            mask=self.mask,
            place_label="Atlanta",
            prompt="Add a shelter",
            consent_at=datetime.now(timezone.utc),
        )

    def _generate(self, key=None, user="jobs-owner", **extra):
        payload = {
            "expectedRevision": self.post.revision,
            "prompt": "Add a covered shelter",
            "maskAssetId": str(self.mask.id),
            **extra,
        }
        return self.client.post(
            f"/api/v1/posts/{self.post.id}/generate",
            payload,
            format="json",
            HTTP_X_DEV_USER=user,
            HTTP_IDEMPOTENCY_KEY=key or str(uuid4()),
        )

    def test_creates_queued_job(self):
        key = str(uuid4())
        response = self._generate(key)

        self.assertEqual(response.status_code, 202)
        body = response.json()
        self.assertEqual(body["postId"], str(self.post.id))
        job = self.post.jobs.get()
        self.assertEqual(body["jobId"], str(job.id))
        self.assertEqual(job.status, "queued")
        self.assertEqual(job.stage, "queued")
        self.assertEqual(job.base_revision, 1)
        self.assertEqual(job.payload["maskAssetId"], str(self.mask.id))

    def test_same_key_returns_original_job(self):
        key = str(uuid4())
        first = self._generate(key)
        second = self._generate(key)

        self.assertEqual(first.status_code, 202)
        self.assertEqual(second.status_code, 202)
        self.assertEqual(first.json(), second.json())
        self.assertEqual(self.post.jobs.count(), 1)

    def test_ready_post_returns_to_draft(self):
        self.post.status = PostStatus.READY
        self.post.save(update_fields=["status"])

        response = self._generate()

        self.assertEqual(response.status_code, 202)
        self.post.refresh_from_db()
        self.assertEqual(self.post.status, PostStatus.DRAFT)
        self.assertEqual(self.post.revision, 1)

    def test_requires_valid_key(self):
        response = self.client.post(
            f"/api/v1/posts/{self.post.id}/generate",
            {
                "expectedRevision": 1,
                "prompt": "Add a covered shelter",
                "maskAssetId": str(self.mask.id),
            },
            format="json",
            HTTP_X_DEV_USER="jobs-owner",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "VALIDATION_ERROR")

    def test_rejects_missing_or_wrong_mask(self):
        response = self._generate(maskAssetId=str(uuid4()))

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "VALIDATION_ERROR")

    def test_rejects_stale_revision(self):
        response = self._generate(expectedRevision=2)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "REVISION_CONFLICT")

    def test_job_status_is_owner_only(self):
        key = str(uuid4())
        created = self._generate(key)
        job_id = created.json()["jobId"]

        own = self.client.get(
            f"/api/v1/jobs/{job_id}",
            HTTP_X_DEV_USER="jobs-owner",
        )
        other = self.client.get(
            f"/api/v1/jobs/{job_id}",
            HTTP_X_DEV_USER="jobs-other",
        )

        self.assertEqual(own.status_code, 200)
        self.assertEqual(own.json()["status"], "queued")
        self.assertEqual(other.status_code, 404)
