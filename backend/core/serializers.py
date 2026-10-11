from __future__ import annotations

import math
from datetime import datetime, timezone as dt_timezone
from importlib import import_module
from typing import Any

from django.conf import settings
from core.models import Asset, Job, JobStatus, Post, User
from core.services.signing import signed_url, thumb_url


def author_payload(user: User, viewer: User | None = None) -> dict[str, Any]:
    return {
        "displayName": user.display_name,
        "isViewer": viewer is not None and user.pk == viewer.pk,
    }


def asset_payload(asset: Asset, *, thumbnail: bool = False) -> dict[str, Any]:
    url = thumb_url(asset) if thumbnail else signed_url(asset)
    expiration = _url_expiration(url)
    return {
        "id": str(asset.pk),
        "kind": asset.kind,
        "width": asset.width,
        "height": asset.height,
        "mimeType": asset.mime_type,
        "sha256": asset.sha256,
        "url": url,
        "urlExpiresAt": _timestamp(expiration),
    }


def public_location(
    post: Post,
    viewer: User | None = None,
) -> dict[str, Any] | None:
    if post.lat is None or post.lng is None:
        return None

    is_owner = viewer is not None and getattr(post, "owner_id") == viewer.pk
    decimals = None if is_owner else settings.PUBLIC_COORD_DECIMALS
    return {
        "lat": post.lat if decimals is None else round(post.lat, decimals),
        "lng": post.lng if decimals is None else round(post.lng, decimals),
        "source": post.location_source,
    }


def post_payload(
    post: Post,
    viewer: User | None = None,
    viewer_coords: tuple[float, float] | None = None,
) -> dict[str, Any]:
    owner = viewer is not None and getattr(post, "owner_id") == viewer.pk
    concept_id = getattr(post, "concept_id")
    concept = post.concept if concept_id else None
    return {
        "id": str(post.id),
        "revision": post.revision,
        "status": post.status,
        "createdAt": _timestamp(post.created_at),
        "updatedAt": _timestamp(post.updated_at),
        "publishedAt": _timestamp(post.published_at),
        "author": author_payload(post.owner, viewer),
        "title": post.title,
        "prompt": post.prompt,
        "placeLabel": post.place_label,
        "location": public_location(post, viewer),
        "distanceKm": _distance_km(post, viewer_coords),
        "source": asset_payload(post.source),
        "concept": asset_payload(concept) if concept else None,
        "maskAssetId": (
            str(getattr(post, "mask_id"))
            if owner and getattr(post, "mask_id")
            else None
        ),
        "review": post.review,
        "generation": post.generation,
        "activeJob": _active_job_payload(post),
        "aiDisclosure": settings.AI_DISCLOSURE,
        "score": post.score,
        "upvotes": post.upvotes,
        "downvotes": post.downvotes,
        "viewerVote": _viewer_vote(post, viewer),
        "commentCount": post.comment_count,
    }


def post_summary_payload(
    post: Post,
    viewer: User | None = None,
    viewer_coords: tuple[float, float] | None = None,
) -> dict[str, Any]:
    concept_id = getattr(post, "concept_id")
    concept = post.concept if concept_id else None
    return {
        "id": str(post.id),
        "status": post.status,
        "title": post.title,
        "promptPreview": post.prompt[:140],
        "placeLabel": post.place_label,
        "location": public_location(post, viewer),
        "distanceKm": _distance_km(post, viewer_coords),
        "publishedAt": _timestamp(post.published_at),
        "updatedAt": _timestamp(post.updated_at),
        "sourceThumbUrl": thumb_url(post.source),
        "conceptThumbUrl": thumb_url(concept) if concept else None,
        "score": post.score,
        "viewerVote": _viewer_vote(post, viewer),
        "commentCount": post.comment_count,
        "author": author_payload(post.owner, viewer),
    }


def job_payload(job: Job) -> dict[str, Any]:
    return {
        "id": str(job.pk),
        "postId": str(job.post.pk),
        "kind": job.kind,
        "status": job.status,
        "stage": job.stage,
        "attempt": job.attempt,
        "createdAt": _timestamp(job.created_at),
        "updatedAt": _timestamp(job.updated_at),
        "error": job.error,
    }


def me_payload(user: User) -> dict[str, Any]:
    return {
        "id": str(user.pk),
        "displayName": user.display_name,
        "createdAt": _timestamp(user.created_at),
    }


def _active_job_payload(post: Post) -> dict[str, Any] | None:
    job = (
        Job.objects.filter(
            post=post,
            status__in=(JobStatus.QUEUED, JobStatus.RUNNING),
        )
        .order_by("-created_at")
        .first()
    )
    return job_payload(job) if job else None


def _viewer_vote(post: Post, viewer: User | None) -> int:
    if viewer is None:
        return 0
    try:
        vote_model = getattr(import_module("community.models"), "Vote")
    except ImportError:
        return 0
    vote = (
        vote_model.objects.filter(post=post, user=viewer)
        .values_list("value", flat=True)
        .first()
    )
    return vote or 0


def _distance_km(
    post: Post,
    viewer_coords: tuple[float, float] | None,
) -> float | None:
    if viewer_coords is None or post.lat is None or post.lng is None:
        return None
    viewer_lat, viewer_lng = map(math.radians, viewer_coords)
    post_lat, post_lng = math.radians(post.lat), math.radians(post.lng)
    delta_lat = post_lat - viewer_lat
    delta_lng = post_lng - viewer_lng
    haversine = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(viewer_lat) * math.cos(post_lat) * math.sin(delta_lng / 2) ** 2
    )
    return round(6371 * 2 * math.asin(math.sqrt(haversine)), 1)


def _timestamp(value: datetime | int | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.astimezone(dt_timezone.utc).isoformat().replace("+00:00", "Z")
    return datetime.fromtimestamp(value, dt_timezone.utc).isoformat().replace("+00:00", "Z")


def _url_expiration(url: str) -> int:
    return int(url.split("exp=", 1)[1].split("&", 1)[0])
