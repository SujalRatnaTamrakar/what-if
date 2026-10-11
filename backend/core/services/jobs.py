"""Job queue — §9.5 step 4 of the master plan.

DB-backed queue, no Redis/Celery. claim() uses select_for_update(skip_locked=True)
on Postgres; on sqlite (dev) it falls back to a plain select_for_update since
sqlite has no SKIP LOCKED.
"""
from __future__ import annotations

import logging
import socket
from datetime import timedelta
from urllib.parse import urlparse

from django.conf import settings
from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone

from core.exceptions import ApiError
from core.models import Job

log = logging.getLogger(__name__)

_RETRYABLE_JOB_CODES = {
    "PROVIDER_UNAVAILABLE",
    "PROVIDER_TIMEOUT",
    "INVALID_PROVIDER_OUTPUT",
    "RENDER_FAILED",
    "RATE_LIMITED",
    "INTERNAL",
}


def is_retryable_code(code: str) -> bool:
    return code in _RETRYABLE_JOB_CODES


def enqueue(kind: str, proposal, payload: dict | None = None, idempotency_key: str | None = None) -> Job:
    """Create a queued job. Enforces the (proposal, idempotency_key) uniqueness
    in code so it also holds on sqlite (partial unique index is Postgres-only)."""
    with transaction.atomic():
        if idempotency_key:
            existing = (
                Job.objects.select_for_update()
                .filter(proposal=proposal, idempotency_key=idempotency_key)
                .first()
            )
            if existing:
                return existing
        job = Job.objects.create(
            proposal=proposal,
            owner=proposal.owner,
            kind=kind,
            status="queued",
            stage="queued",
            base_revision=proposal.revision,
            payload=payload or {},
            idempotency_key=idempotency_key,
        )
        return job


def find_by_idempotency_key(proposal, idempotency_key: str | None):
    if not idempotency_key:
        return None
    return Job.objects.filter(proposal=proposal, idempotency_key=idempotency_key).first()


def active_job_for(proposal) -> Job | None:
    return (
        Job.objects.filter(proposal=proposal, status__in=("queued", "running"))
        .order_by("-created_at")
        .first()
    )


def claim() -> Job | None:
    """Claim the oldest claimable job. Returns None when the queue is empty."""
    with transaction.atomic():
        qs = Job.objects.filter(
            Q(status="queued") | Q(status="running", lease_expires_at__lt=timezone.now()),
            attempt__lt=settings.JOB_MAX_ATTEMPTS,
        ).order_by("created_at")
        if connection.vendor == "sqlite":
            job = qs.select_for_update().first()
        else:
            job = qs.select_for_update(skip_locked=True).first()
        if job is None:
            return None
        job.status = "running"
        job.attempt += 1
        job.lease_expires_at = timezone.now() + timedelta(seconds=settings.JOB_LEASE_SECONDS)
        job.save(update_fields=["status", "attempt", "lease_expires_at", "updated_at"])
        return job


def sweep_expired() -> int:
    """Mark jobs that exhausted attempts with an expired lease as failed."""
    now = timezone.now()
    stale = Job.objects.filter(
        status="running",
        lease_expires_at__lt=now,
        attempt__gte=settings.JOB_MAX_ATTEMPTS,
    )
    count = 0
    for job in stale:
        fail(job, "PROVIDER_TIMEOUT", "Job lease expired after max attempts.", stage=job.stage)
        count += 1
    return count


def heartbeat(job: Job, stage: str) -> None:
    job.stage = stage
    job.lease_expires_at = timezone.now() + timedelta(seconds=settings.JOB_LEASE_SECONDS)
    job.save(update_fields=["stage", "lease_expires_at", "updated_at"])


def complete(job: Job) -> None:
    job.status = "succeeded"
    job.stage = "done"
    job.error = None
    job.save(update_fields=["status", "stage", "error", "updated_at"])


def fail(job: Job, code: str, message: str, *, stage: str | None = None, retryable: bool | None = None) -> None:
    if retryable is None:
        retryable = is_retryable_code(code)
    job.error = {"code": code, "message": message, "retryable": retryable}
    if stage:
        job.stage = stage
    if retryable and job.attempt < settings.JOB_MAX_ATTEMPTS:
        job.status = "queued"
        job.lease_expires_at = None
    else:
        job.status = "failed"
    job.save(update_fields=["error", "stage", "status", "lease_expires_at", "updated_at"])


def _tcp_reachable(base_url: str, timeout: float = 2.0) -> bool:
    try:
        parts = urlparse(base_url)
        host, port = parts.hostname, parts.port or (443 if parts.scheme == "https" else 80)
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False


def check_scene_provider() -> None:
    """Raise 503 PROVIDER_UNAVAILABLE when the configured scene provider is
    unreachable (used by E9 before enqueueing)."""
    provider = (settings.SCENE_PROVIDER or "fake").lower()
    if provider == "fake":
        return
    if provider == "ollama":
        if not _tcp_reachable(settings.OLLAMA_BASE_URL):
            raise ApiError("PROVIDER_UNAVAILABLE", "Ollama is unreachable.")
        return
    if provider == "gemini":
        if not settings.GEMINI_API_KEY:
            raise ApiError("PROVIDER_UNAVAILABLE", "GEMINI_API_KEY is not set.")
        return
    if provider == "openai":
        if not settings.OPENAI_API_KEY:
            raise ApiError("PROVIDER_UNAVAILABLE", "OPENAI_API_KEY is not set.")
        return
    if provider == "fallback":
        # Chains degrade gracefully at runtime; only reject a totally empty config.
        from backend.agents.providers import _DEFAULT_CHAINS, _ROLE_CHAIN_ENV

        raw = getattr(settings, _ROLE_CHAIN_ENV["scene"], None) or _DEFAULT_CHAINS["scene"]
        if not [p for p in str(raw).split(",") if p.strip()]:
            raise ApiError("PROVIDER_UNAVAILABLE", "SCENE_CHAIN is empty.")
        return
    raise ApiError("PROVIDER_UNAVAILABLE", f"Unknown SCENE_PROVIDER={provider!r}.")
