from __future__ import annotations

from typing import Any

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from common.http import err
from core.models import Asset, AssetKind, Post, PostStatus
from core.permissions import get_visible_post_or_404
from core.serializers import post_payload
from core.services.events import record
from core.services.images import sanitize_upload


LOCATION_SOURCES = {"gps", "exif", "manual", "none"}


@api_view(["GET"])
def get_post(request, post_id):
    viewer = request.user if getattr(request.user, "is_authenticated", False) else None
    post = get_visible_post_or_404(post_id, viewer)
    lat, lng = _coordinates(request.query_params)
    viewer_coords = (lat, lng) if lat is not None and lng is not None else None
    return Response(post_payload(post, viewer, viewer_coords))


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


setattr(create_post, "throttle_scope", "upload")
