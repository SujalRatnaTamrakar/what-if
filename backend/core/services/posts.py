from collections.abc import Iterable
from typing import Any

from django.db import transaction
from rest_framework import status

from common.http import err
from core.models import Job, JobStatus, Post, User


def lock_owned_post(post_id: Any, owner: User) -> Post:
    """Lock and return a post owned by ``owner`` inside a transaction."""
    with transaction.atomic():
        post = (
            Post.objects.select_for_update()
            .filter(id=post_id, owner=owner)
            .first()
        )
        if post is None:
            err(
                "NOT_FOUND",
                status.HTTP_404_NOT_FOUND,
                "Post not found.",
            )
        return post


def assert_revision(post: Post, expected_revision: int) -> None:
    if post.revision != expected_revision:
        err(
            "REVISION_CONFLICT",
            status.HTTP_409_CONFLICT,
            "The post has changed. Refresh and try again.",
        )


def assert_status(
    post: Post,
    allowed_statuses: Iterable[str],
) -> None:
    allowed = set(allowed_statuses)
    if post.status not in allowed:
        err(
            "INVALID_STATE",
            status.HTTP_409_CONFLICT,
            "The post is not in a state that allows this operation.",
        )


def assert_no_active_job(post: Post) -> None:
    if Job.objects.filter(
        post=post,
        status__in=(JobStatus.QUEUED, JobStatus.RUNNING),
    ).exists():
        err(
            "JOB_IN_PROGRESS",
            status.HTTP_409_CONFLICT,
            "A job is already in progress for this post.",
            retryable=True,
        )


def bump_revision(post: Post) -> Post:
    post.revision += 1
    post.save(update_fields=["revision", "updated_at"])
    return post