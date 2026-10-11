from __future__ import annotations

from typing import Any, NoReturn

from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.http import err
from core.models import Asset, AssetKind, Post, PostStatus
from core.services.masks import rasterize_strokes, sanitize_png_mask, save_mask_image
from core.services.posts import assert_no_active_job, assert_revision


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def save_mask(request, post_id):
    with transaction.atomic():
        post = (
            Post.objects.select_for_update()
            .select_related("source")
            .filter(id=post_id, owner=request.user)
            .first()
        )
        if post is None:
            err("NOT_FOUND", status.HTTP_404_NOT_FOUND, "Post not found.")
        if post.status not in (PostStatus.DRAFT, PostStatus.READY):
            err(
                "INVALID_STATE",
                status.HTTP_409_CONFLICT,
                "The post is not accepting a mask.",
            )
        assert_no_active_job(post)

        expected_revision = _expected_revision(request.data.get("expectedRevision"))
        assert_revision(post, expected_revision)

        upload = request.FILES.get("mask")
        if upload is not None:
            mask_image = sanitize_png_mask(
                upload,
                width=post.source.width,
                height=post.source.height,
            )
        else:
            strokes = request.data.get("strokes")
            if not isinstance(strokes, dict):
                err(
                    "VALIDATION_ERROR",
                    status.HTTP_400_BAD_REQUEST,
                    "strokes is required.",
                    fields={"strokes": ["This field is required."]},
                )
            mask_image = rasterize_strokes(
                strokes,
                width=post.source.width,
                height=post.source.height,
            )

        asset_fields = save_mask_image(
            mask_image,
            owner_id=request.user.pk,
            post_id=post.pk,
        )
        mask_asset = Asset.objects.create(kind=AssetKind.MASK, **asset_fields)
        post.mask = mask_asset
        post.revision += 1
        post.status = PostStatus.DRAFT
        post.save(update_fields=["mask", "revision", "status", "updated_at"])

    return Response(
        {"assetId": str(mask_asset.pk), "revision": post.revision},
        status=status.HTTP_201_CREATED,
    )


def _expected_revision(value: Any) -> int:
    if isinstance(value, bool):
        _invalid_revision()
    try:
        revision = int(value)
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
