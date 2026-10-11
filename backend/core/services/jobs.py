from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from core.models import Job, JobStage, JobStatus


logger = logging.getLogger(__name__)


def claim() -> Job | None:
    """Atomically claim the oldest queued or expired running job."""
    now = timezone.now()
    with transaction.atomic():
        sweep_exhausted(now)
        job = (
            Job.objects.select_for_update(skip_locked=True)
            .filter(
                Q(status=JobStatus.QUEUED)
                | Q(
                    status=JobStatus.RUNNING,
                    lease_expires_at__lt=now,
                ),
                attempt__lt=settings.JOB_MAX_ATTEMPTS,
            )
            .order_by("created_at")
            .first()
        )
        if job is None:
            return None

        job.status = JobStatus.RUNNING
        job.attempt += 1
        job.lease_expires_at = now + timedelta(
            seconds=settings.JOB_LEASE_SECONDS,
        )
        job.save(update_fields=["status", "attempt", "lease_expires_at", "updated_at"])
        logger.info("claimed job=%s attempt=%s", job.pk, job.attempt)
        return job


def heartbeat(job: Job, stage: str) -> None:
    """Advance a job stage and renew its lease."""
    now = timezone.now()
    Job.objects.filter(id=job.id, status=JobStatus.RUNNING).update(
        stage=stage,
        lease_expires_at=now + timedelta(seconds=settings.JOB_LEASE_SECONDS),
        updated_at=now,
    )
    job.stage = stage
    job.lease_expires_at = now + timedelta(seconds=settings.JOB_LEASE_SECONDS)


def succeed(job: Job) -> None:
    Job.objects.filter(id=job.id).update(
        status=JobStatus.SUCCEEDED,
        stage=JobStage.DONE,
        lease_expires_at=None,
        updated_at=timezone.now(),
    )
    job.status = JobStatus.SUCCEEDED
    job.stage = JobStage.DONE
    job.lease_expires_at = None
    logger.info("succeeded job=%s", job.pk)


def fail(
    job: Job,
    code: str,
    message: str,
    retryable: bool,
) -> None:
    """Retry a retryable job while attempts remain, otherwise persist failure."""
    exhausted = job.attempt >= settings.JOB_MAX_ATTEMPTS
    now = timezone.now()
    if retryable and not exhausted:
        Job.objects.filter(id=job.id).update(
            status=JobStatus.QUEUED,
            error={"code": code, "message": message, "retryable": True},
            lease_expires_at=None,
            updated_at=now,
        )
        job.status = JobStatus.QUEUED
        setattr(job, "error", {"code": code, "message": message, "retryable": True})
        job.lease_expires_at = None
        logger.warning("requeued job=%s code=%s", job.pk, code)
        return

    Job.objects.filter(id=job.id).update(
        status=JobStatus.FAILED,
        error={"code": code, "message": message, "retryable": retryable},
        lease_expires_at=None,
        updated_at=now,
    )
    job.status = JobStatus.FAILED
    setattr(job, "error", {"code": code, "message": message, "retryable": retryable})
    job.lease_expires_at = None
    logger.warning("failed job=%s code=%s", job.pk, code)


def sweep_exhausted(now: Any | None = None) -> int:
    """Fail expired running jobs that have exhausted their retry budget."""
    current = now or timezone.now()
    return Job.objects.filter(
        status=JobStatus.RUNNING,
        lease_expires_at__lt=current,
        attempt__gte=settings.JOB_MAX_ATTEMPTS,
    ).update(
        status=JobStatus.FAILED,
        error={
            "code": "PROVIDER_TIMEOUT",
            "message": "The job lease expired.",
            "retryable": True,
        },
        lease_expires_at=None,
        updated_at=current,
    )
