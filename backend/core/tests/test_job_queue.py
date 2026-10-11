from datetime import datetime, timedelta, timezone

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from core.models import Asset, AssetKind, Job, JobStage, JobStatus, Post
from core.services.jobs import claim, fail, heartbeat, succeed, sweep_exhausted


User = get_user_model()


class JobQueueTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            auth0_sub="dev|queue-user",
            display_name="Queue User",
        )
        source = Asset.objects.create(
            owner=self.user,
            kind=AssetKind.SOURCE,
            file_path="sources/source.jpg",
            mime_type="image/jpeg",
            width=100,
            height=100,
            sha256="a" * 64,
        )
        self.post = Post.objects.create(
            owner=self.user,
            source=source,
            consent_at=datetime.now(timezone.utc),
        )

    def _job(self, **kwargs):
        fields = {
            "post": self.post,
            "owner": self.user,
            "kind": "generate",
            "status": JobStatus.QUEUED,
            "stage": JobStage.QUEUED,
            "base_revision": 1,
        }
        fields.update(kwargs)
        return Job.objects.create(
            **fields,
        )

    @override_settings(JOB_LEASE_SECONDS=60, JOB_MAX_ATTEMPTS=2)
    def test_claim_increments_attempt_and_sets_lease(self):
        job = self._job()

        claimed = claim()

        self.assertEqual(claimed.pk, job.pk)
        claimed.refresh_from_db()
        self.assertEqual(claimed.status, JobStatus.RUNNING)
        self.assertEqual(claimed.attempt, 1)
        self.assertIsNotNone(claimed.lease_expires_at)

    def test_expired_running_job_can_be_reclaimed(self):
        job = self._job(
            status=JobStatus.RUNNING,
            attempt=1,
            lease_expires_at=datetime.now(timezone.utc) - timedelta(seconds=1),
        )

        claimed = claim()

        self.assertEqual(claimed.pk, job.pk)
        self.assertEqual(claimed.attempt, 2)

    @override_settings(JOB_LEASE_SECONDS=60)
    def test_heartbeat_updates_stage_and_lease(self):
        job = self._job(status=JobStatus.RUNNING, attempt=1)
        heartbeat(job, JobStage.RENDER)

        job.refresh_from_db()
        self.assertEqual(job.stage, JobStage.RENDER)
        self.assertIsNotNone(job.lease_expires_at)

    def test_succeed_marks_done(self):
        job = self._job(status=JobStatus.RUNNING, attempt=1)

        succeed(job)

        job.refresh_from_db()
        self.assertEqual(job.status, JobStatus.SUCCEEDED)
        self.assertEqual(job.stage, JobStage.DONE)
        self.assertIsNone(job.lease_expires_at)

    @override_settings(JOB_MAX_ATTEMPTS=2)
    def test_retryable_failure_requeues_before_limit(self):
        job = self._job(status=JobStatus.RUNNING, attempt=1)

        fail(job, "PROVIDER_TIMEOUT", "temporary", True)

        job.refresh_from_db()
        self.assertEqual(job.status, JobStatus.QUEUED)
        self.assertEqual(job.error["code"], "PROVIDER_TIMEOUT")

    @override_settings(JOB_MAX_ATTEMPTS=2)
    def test_exhausted_failure_is_terminal(self):
        job = self._job(status=JobStatus.RUNNING, attempt=2)

        fail(job, "PROVIDER_TIMEOUT", "temporary", True)

        job.refresh_from_db()
        self.assertEqual(job.status, JobStatus.FAILED)

    @override_settings(JOB_MAX_ATTEMPTS=2)
    def test_sweep_exhausted_fails_expired_job(self):
        job = self._job(
            status=JobStatus.RUNNING,
            attempt=2,
            lease_expires_at=datetime.now(timezone.utc) - timedelta(seconds=1),
        )

        count = sweep_exhausted()

        self.assertEqual(count, 1)
        job.refresh_from_db()
        self.assertEqual(job.status, JobStatus.FAILED)
        self.assertEqual(job.error["code"], "PROVIDER_TIMEOUT")
