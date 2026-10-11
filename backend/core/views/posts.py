from __future__ import annotations

from typing import Any, NoReturn

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from common.http import err
from core.models import Asset, AssetKind, Post, PostStatus
from core.permissions import get_visible_post_or_404
from core.serializers import post_payload
from core.services.events import record
from core.services.images import sanitize_upload
from core.services.posts import assert_no_active_job, assert_revision


LOCATION_SOURCES = {"gps", "exif", "manual", "none"}


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticatedOrReadOnly])
def get_post(request, post_id):
    if request.method != "GET":
        return _mutate_post(request, post_id)
    viewer = request.user if getattr(request.user, "is_authenticated", False) else None
    post = get_visible_post_or_404(post_id, viewer)
    lat, lng = _coordinates(request.query_params)
    viewer_coords = (lat, lng) if lat is not None and lng is not None else None
    return Response(post_payload(post, viewer, viewer_coords))


def _mutate_post(request, post_id):
    with transaction.atomic():
        post = (
            Post.objects.select_for_update()
            .select_related("owner", "source")
            .filter(id=post_id, owner=request.user)
            .exclude(status=PostStatus.REMOVED)
            .first()
        )
        if post is None:
            err("NOT_FOUND", status.HTTP_404_NOT_FOUND, "Post not found.")

        if request.method == "DELETE":
            post.status = PostStatus.REMOVED
            post.save(update_fields=["status", "updated_at"])
            record("post_deleted", post=post, user=request.user)
            return Response(status=status.HTTP_204_NO_CONTENT)

        assert_no_active_job(post)
        expected_revision = _expected_revision(request.data.get("expectedRevision"))
        assert_revision(post, expected_revision)
        _update_post_fields(post, request.data)
        post.revision += 1
        post.save(
            update_fields=[
                "title",
                "title_user_edited",
                "prompt",
                "place_label",
                "revision",
                "updated_at",
            ]
        )
        record("post_updated", post=post, user=request.user)

    return Response(post_payload(post, request.user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([ScopedRateThrottle])
def create_post(request):
    upload = request.FILES.get("photo")
    if upload is None:
        err(
            "VALIDATION_ERROR",
            status.HTTP_400_BAD_REQUEST,
            "photo is required.",
            fields={"photo": ["This field is required."]},
        )

    if request.data.get("consent") is not True and request.data.get("consent") != "true":
        err(
            "CONSENT_REQUIRED",
            status.HTTP_400_BAD_REQUEST,
            "Consent is required to create a post.",
        )

    place_label = request.data.get("placeLabel", "")
    if not isinstance(place_label, str) or len(place_label) > 120:
        err(
            "VALIDATION_ERROR",
            status.HTTP_400_BAD_REQUEST,
            "placeLabel must be 120 characters or fewer.",
            fields={"placeLabel": ["Use 120 characters or fewer."]},
        )

    location_source = request.data.get("locationSource", "none")
    if location_source not in LOCATION_SOURCES:
        err(
            "VALIDATION_ERROR",
            status.HTTP_400_BAD_REQUEST,
            "locationSource is invalid.",
            fields={"locationSource": ["Use gps, exif, manual, or none."]},
        )

    lat, lng = _coordinates(request.data)
    location_accuracy_m = _optional_float(
        request.data.get("locationAccuracyM"),
        "locationAccuracyM",
    )
    sanitized = sanitize_upload(upload)
    if lat is None and lng is None and sanitized["latitude"] is not None:
        lat = sanitized["latitude"]
        lng = sanitized["longitude"]
        location_source = "exif"
    elif lat is None:
        location_source = "none"

    user = request.user
    with transaction.atomic():
        source = Asset.objects.create(
            owner=user,
            kind=AssetKind.SOURCE,
            file_path=sanitized["path"],
            mime_type=sanitized["mime_type"],
            width=sanitized["width"],
            height=sanitized["height"],
            sha256=sanitized["sha256"],
        )
        post = Post.objects.create(
            owner=user,
            status=PostStatus.DRAFT,
            revision=1,
            prompt="",
            title="",
            place_label=place_label.strip(),
            lat=lat,
            lng=lng,
            location_source=location_source,
            location_accuracy_m=location_accuracy_m,
            source=source,
            consent_at=timezone.now(),
        )
        setattr(source, "post", post)
        source.save(update_fields=["post"])
        record("post_created", post=post, user=user)

    return Response(post_payload(post, user), status=status.HTTP_201_CREATED)


def _coordinates(data: Any) -> tuple[float | None, float | None]:
    raw_lat = data.get("lat")
    raw_lng = data.get("lng")
    if (raw_lat is None) != (raw_lng is None):
        err(
            "VALIDATION_ERROR",
            status.HTTP_400_BAD_REQUEST,
            "lat and lng must be provided together.",
            fields={"location": ["lat and lng must be provided together."]},
        )
    if raw_lat is None:
        return None, None
    try:
        lat = float(raw_lat)
        lng = float(raw_lng)
    except (TypeError, ValueError):
        err(
            "VALIDATION_ERROR",
            status.HTTP_400_BAD_REQUEST,
            "lat and lng must be numbers.",
            fields={"location": ["Use numeric coordinates."]},
        )
    if not -90 <= lat <= 90 or not -180 <= lng <= 180:
        err(
            "VALIDATION_ERROR",
            status.HTTP_400_BAD_REQUEST,
            "Coordinates are outside the valid range.",
            fields={"location": ["Use valid latitude and longitude values."]},
        )
    return lat, lng


def _optional_float(value: Any, field: str) -> float | None:
    if value in (None, ""):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        err(
            "VALIDATION_ERROR",
            status.HTTP_400_BAD_REQUEST,
            f"{field} must be a number.",
            fields={field: ["Use a numeric value."]},
        )
    return number


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


def _update_post_fields(post: Post, data: Any) -> None:
    editable_fields = {"title", "prompt", "placeLabel"}
    unknown_fields = set(data.keys()) - {"expectedRevision"} - editable_fields
    if unknown_fields:
        field = sorted(unknown_fields)[0]
        err(
            "VALIDATION_ERROR",
            status.HTTP_400_BAD_REQUEST,
            f"{field} is not editable.",
            fields={field: ["This field is not editable."]},
        )

    if "title" in data:
        title = data["title"]
        if not isinstance(title, str) or len(title) > 120:
            err(
                "VALIDATION_ERROR",
                status.HTTP_400_BAD_REQUEST,
                "title must be 120 characters or fewer.",
                fields={"title": ["Use 120 characters or fewer."]},
            )
        post.title = title.strip()
        post.title_user_edited = True
    elif post.status == PostStatus.PUBLISHED and (
        "prompt" in data or "placeLabel" in data
    ):
        err(
            "INVALID_STATE",
            status.HTTP_409_CONFLICT,
            "Only the title can be edited after publishing.",
        )

    if "prompt" in data:
        prompt = data["prompt"]
        if (
            not isinstance(prompt, str)
            or not settings.PROMPT_MIN_CHARS
            <= len(prompt.strip())
            <= settings.PROMPT_MAX_CHARS
        ):
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
        post.prompt = prompt.strip()

    if "placeLabel" in data:
        place_label = data["placeLabel"]
        if not isinstance(place_label, str) or len(place_label) > 120:
            err(
                "VALIDATION_ERROR",
                status.HTTP_400_BAD_REQUEST,
                "placeLabel must be 120 characters or fewer.",
                fields={"placeLabel": ["Use 120 characters or fewer."]},
            )
        post.place_label = place_label.strip()


setattr(create_post, "throttle_scope", "upload")
