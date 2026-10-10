from datetime import datetime, timezone
from uuid import uuid4

from django.test import TestCase
from rest_framework.exceptions import APIException

from core.models import Asset, AssetKind, Job, JobKind, JobStatus, Post, PostStatus
from core.services.posts import (
    assert_no_active_job,
    assert_revision,
    assert_status,
    bump_revision,
    lock_owned_post,
)
from django.contrib.auth import get_user_model


User = get_user_model()


class PostServiceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            auth0_sub="dev|post-owner",
            display_name="Post Owner",
        )
        self.other_user = User.objects.create_user(
            auth0_sub="dev|other-user",
            display_name="Other User",
        )
        source = Asset.objects.create(
            owner=self.owner,
            kind=AssetKind.SOURCE,
            file_path="sources/test.jpg",
            mime_type="image/jpeg",
            width=100,
            height=100,
            sha256="a" * 64,
        )
        self.post = Post.objects.create(
            owner=self.owner,
            source=source,
            consent_at=datetime.now(timezone.utc),
        )
        source.post = self.post
        source.save(update_fields=["post"])

    def test_lock_owned_post_returns_the_locked_post(self):
        with self.assertNumQueries(3):
            locked_post = lock_owned_post(self.post.id, self.owner)

        self.assertEqual(locked_post.id, self.post.id)

    def test_lock_owned_post_hides_other_users_posts(self):
        with self.assertRaises(APIException) as raised:
            lock_owned_post(self.post.id, self.other_user)

        self.assertEqual(raised.exception.code, "NOT_FOUND")
        self.assertEqual(raised.exception.status_code, 404)

    def test_lock_owned_post_returns_not_found_for_unknown_post(self):
        with self.assertRaises(APIException) as raised:
            lock_owned_post(uuid4(), self.owner)

        self.assertEqual(raised.exception.code, "NOT_FOUND")

    def test_assert_revision_accepts_current_revision(self):
        assert_revision(self.post, self.post.revision)

    def test_assert_revision_rejects_stale_revision(self):
        with self.assertRaises(APIException) as raised:
            assert_revision(self.post, self.post.revision - 1)

        self.assertEqual(raised.exception.code, "REVISION_CONFLICT")
        self.assertEqual(raised.exception.status_code, 409)

    def test_assert_status_accepts_allowed_status(self):
        assert_status(self.post, {PostStatus.DRAFT, PostStatus.READY})

    def test_assert_status_rejects_disallowed_status(self):
        self.post.status = PostStatus.PUBLISHED

        with self.assertRaises(APIException) as raised:
            assert_status(self.post, {PostStatus.DRAFT, PostStatus.READY})

        self.assertEqual(raised.exception.code, "INVALID_STATE")
        self.assertEqual(raised.exception.status_code, 409)

    def test_assert_no_active_job_accepts_finished_jobs(self):
        Job.objects.create(
            post=self.post,
            owner=self.owner,
            kind=JobKind.GENERATE,
            status=JobStatus.SUCCEEDED,
            base_revision=self.post.revision,
        )

        assert_no_active_job(self.post)

    def test_assert_no_active_job_rejects_queued_and_running_jobs(self):
        for job_status in (JobStatus.QUEUED, JobStatus.RUNNING):
            with self.subTest(job_status=job_status):
                Job.objects.create(
                    post=self.post,
                    owner=self.owner,
                    kind=JobKind.GENERATE,
                    status=job_status,
                    base_revision=self.post.revision,
                    idempotency_key=job_status,
                )

                with self.assertRaises(APIException) as raised:
                    assert_no_active_job(self.post)

                self.assertEqual(raised.exception.code, "JOB_IN_PROGRESS")
                self.assertTrue(raised.exception.retryable)
                Job.objects.filter(post=self.post).delete()

    def test_bump_revision_increments_and_persists_once(self):
        original_revision = self.post.revision

        bump_revision(self.post)

        self.post.refresh_from_db()
        self.assertEqual(self.post.revision, original_revision + 1)
