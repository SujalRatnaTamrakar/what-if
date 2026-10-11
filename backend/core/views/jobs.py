from __future__ import annotations

from typing import NoReturn
from uuid import UUID

from django.conf import settings
from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from common.http import err
from core.models import Job, JobKind, JobStage, JobStatus, Post, PostStatus
from core.serializers import job_payload
from core.services.events import record
from core.services.posts import assert_no_active_job, assert_revision


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([ScopedRateThrottle])
def create_generation_job(request, post_id):
    idempotency_key = request.headers.get("Idempotency-Key")
    key_uuid = _parse_idempotency_key(idempotency_key)

    with transaction.atomic():
        post = (
            Post.objects.select_for_update()
            .select_related("source")
            .filter(id=post_id, owner=request.user)
            .first()
        )
        if post is None:
            err("NOT_FOUND", status.HTTP_404_NOT_FOUND, "Post not found.")

        existing = (
            Job.objects.select_related("post")
            .filter(post=post, idempotency_key=str(key_uuid))
            .first()
        )
        if existing is not None:
            return Response(
                {"jobId": str(existing.id), "postId": str(post.id)},
                status=status.HTTP_202_ACCEPTED,
            )

        if post.status not in (PostStatus.DRAFT, PostStatus.READY):
            err(
                "INVALID_STATE",
                status.HTTP_409_CONFLICT,
                "The post is not ready for generation.",
            )
        assert_no_active_job(post)

        expected_revision = _expected_revision(request.data.get("expectedRevision"))
        assert_revision(post, expected_revision)
        prompt = _prompt(request.data.get("prompt"))
        mask_asset_id = request.data.get("maskAssetId")
        if str(getattr(post, "mask_id", "")) != str(mask_asset_id):
            err(
                "VALIDATION_ERROR",
                status.HTTP_400_BAD_REQUEST,
                "maskAssetId must reference the post mask.",
                fields={"maskAssetId": ["Use the saved mask for this post."]},
            )

        try:
            job = Job.objects.create(
                post=post,
                owner=request.user,
                kind=JobKind.GENERATE,
                status=JobStatus.QUEUED,
                stage=JobStage.QUEUED,
                attempt=0,
                base_revision=post.revision,
                payload={
                    "prompt": prompt,
                    "maskAssetId": str(mask_asset_id),
                },
                idempotency_key=str(key_uuid),
            )
        except IntegrityError:
            job = Job.objects.get(
                post=post,
                idempotency_key=str(key_uuid),
            )

        if post.status == PostStatus.READY:
            post.status = PostStatus.DRAFT
            post.save(update_fields=["status", "updated_at"])
        if post.prompt != prompt:
            post.prompt = prompt
            post.save(update_fields=["prompt", "updated_at"])
        record("generation_requested", post=post, user=request.user)

    return Response(
        {"jobId": str(job.id), "postId": str(post.id)},
        status=status.HTTP_202_ACCEPTED,
    )


setattr(create_generation_job, "throttle_scope", "generate")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_job(request, job_id):
    job = (
        Job.objects.select_related("post")
        .filter(id=job_id, owner=request.user)
        .first()
    )
    if job is None:
        err("NOT_FOUND", status.HTTP_404_NOT_FOUND, "Job not found.")
    return Response(job_payload(job))


def _parse_idempotency_key(value: str | None) -> UUID:
    try:
        return UUID(value or "")
    except (AttributeError, ValueError):
        err(
            "VALIDATION_ERROR",
            status.HTTP_400_BAD_REQUEST,
            "Idempotency-Key must be a UUID.",
            fields={"Idempotency-Key": ["Use a valid UUID."]},
        )


def _expected_revision(value: object) -> int:
    if isinstance(value, bool):
        _invalid_revision()
    try:
        revision = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        _invalid_revision()
    if revision < 1:
        _invalid_revision()
    return revision


def _invalid_revision() -> NoReturn:
    err(
        "VALIDATION_ERROR",
        status.HTTP_400_BAD_REQUEST,
        "expectedRevision must be a positive integer.",
        fields={"expectedRevision": ["Use a positive integer."]},
    )


def _prompt(value: object) -> str:
    if not isinstance(value, str):
        _invalid_prompt()
    prompt = value.strip()
    if not settings.PROMPT_MIN_CHARS <= len(prompt) <= settings.PROMPT_MAX_CHARS:
        _invalid_prompt()
    return prompt


def _invalid_prompt() -> NoReturn:
    err(
        "VALIDATION_ERROR",
        status.HTTP_400_BAD_REQUEST,
        "prompt length is invalid.",
        fields={
            "prompt": [
                f"Use between {settings.PROMPT_MIN_CHARS} "
                f"and {settings.PROMPT_MAX_CHARS} characters."
            ]
        },
    )
