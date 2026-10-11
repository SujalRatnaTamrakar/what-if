from __future__ import annotations

from typing import Any

from django.db.models import Q
from rest_framework import status

from common.http import err
from core.models import Post, PostStatus, User


def get_visible_post_or_404(
    post_id: Any,
    viewer: User | None = None,
) -> Post:
    """Return a published post or an owned non-removed post."""
    visibility = Q(status=PostStatus.PUBLISHED)
    if viewer is not None:
        visibility |= Q(
            owner=viewer,
            status__in=(PostStatus.DRAFT, PostStatus.READY),
        )

    post = (
        Post.objects.select_related("owner", "source", "concept", "mask")
        .filter(Q(id=post_id) & visibility)
        .first()
    )
    if post is None:
        err(
            "NOT_FOUND",
            status.HTTP_404_NOT_FOUND,
            "Post not found.",
        )
    return post


def get_owned_post_or_404(post_id: Any, owner: User) -> Post:
    post = (
        Post.objects.select_related("owner", "source", "concept", "mask")
        .filter(id=post_id, owner=owner)
        .exclude(status=PostStatus.REMOVED)
        .first()
    )
    if post is None:
        err(
            "NOT_FOUND",
            status.HTTP_404_NOT_FOUND,
            "Post not found.",
        )
    return post
