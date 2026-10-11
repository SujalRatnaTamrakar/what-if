from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from core.models import Asset, AssetKind, Job, JobStage, JobStatus, Post, PostStatus


User = get_user_model()


class PostMutationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.media_directory = TemporaryDirectory()
        self.addCleanup(self.media_directory.cleanup)
        self.settings_override = override_settings(
            DEBUG=True,
            AUTH_DEV_BYPASS=True,
            SECRET_KEY="mutation-secret",
            PUBLIC_BASE_URL="http://testserver",
            MEDIA_ROOT=Path(self.media_directory.name),
        )
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)

        self.owner = User.objects.create_user(
            auth0_sub="dev|mutation-owner",
            display_name="Owner",
        )
        self.other_user = User.objects.create_user(
            auth0_sub="dev|mutation-other",
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
        self.post = Post.objects.create(
            owner=self.owner,
            source=source,
            place_label="Atlanta",
            prompt="Add a shelter",
            consent_at=datetime.now(timezone.utc),
        )

    def test_patch_updates_fields_and_revision(self):
        response = self.client.patch(
            f"/api/v1/posts/{self.post.pk}",
            {
                "expectedRevision": 1,
                "title": "A better shelter",
                "prompt": "Add a covered shelter",
                "placeLabel": "Downtown Atlanta",
            },
            format="json",
            HTTP_X_DEV_USER="mutation-owner",
        )

        self.assertEqual(response.status_code, 200)
        self.post.refresh_from_db()
        self.assertEqual(self.post.revision, 2)
        self.assertEqual(self.post.title, "A better shelter")
        self.assertTrue(self.post.title_user_edited)
        self.assertEqual(response.json()["revision"], 2)

    def test_patch_rejects_stale_revision(self):
        response = self.client.patch(
            f"/api/v1/posts/{self.post.pk}",
            {"expectedRevision": 2, "title": "Stale"},
            format="json",
            HTTP_X_DEV_USER="mutation-owner",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "REVISION_CONFLICT")

    def test_patch_only_allows_title_after_publish(self):
        self.post.status = PostStatus.PUBLISHED
        self.post.save(update_fields=["status"])

        response = self.client.patch(
            f"/api/v1/posts/{self.post.pk}",
            {"expectedRevision": 1, "prompt": "Change the prompt"},
            format="json",
            HTTP_X_DEV_USER="mutation-owner",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "INVALID_STATE")

    def test_patch_allows_title_after_publish(self):
        self.post.status = PostStatus.PUBLISHED
        self.post.save(update_fields=["status"])

        response = self.client.patch(
            f"/api/v1/posts/{self.post.pk}",
            {"expectedRevision": 1, "title": "Published title"},
            format="json",
            HTTP_X_DEV_USER="mutation-owner",
        )

        self.assertEqual(response.status_code, 200)
        self.post.refresh_from_db()
        self.assertEqual(self.post.title, "Published title")
        self.assertEqual(self.post.revision, 2)

    def test_patch_rejects_active_job(self):
        Job.objects.create(
            post=self.post,
            owner=self.owner,
            kind="generate",
            status=JobStatus.RUNNING,
            stage=JobStage.RENDER,
            base_revision=1,
        )

        response = self.client.patch(
            f"/api/v1/posts/{self.post.pk}",
            {"expectedRevision": 1, "title": "Blocked"},
            format="json",
            HTTP_X_DEV_USER="mutation-owner",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "JOB_IN_PROGRESS")

    def test_non_owner_cannot_patch(self):
        response = self.client.patch(
            f"/api/v1/posts/{self.post.pk}",
            {"expectedRevision": 1, "title": "Not allowed"},
            format="json",
            HTTP_X_DEV_USER="mutation-other",
        )

        self.assertEqual(response.status_code, 404)

    def test_delete_soft_deletes_post(self):
        response = self.client.delete(
            f"/api/v1/posts/{self.post.pk}",
            HTTP_X_DEV_USER="mutation-owner",
        )

        self.assertEqual(response.status_code, 204)
        self.post.refresh_from_db()
        self.assertEqual(self.post.status, PostStatus.REMOVED)
        self.assertEqual(self.post.revision, 1)

        detail = self.client.get(f"/api/v1/posts/{self.post.pk}")
        self.assertEqual(detail.status_code, 404)

    def test_delete_requires_owner(self):
        response = self.client.delete(
            f"/api/v1/posts/{self.post.pk}",
            HTTP_X_DEV_USER="mutation-other",
        )

        self.assertEqual(response.status_code, 404)
        self.post.refresh_from_db()
        self.assertNotEqual(self.post.status, PostStatus.REMOVED)
