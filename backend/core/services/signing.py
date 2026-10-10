from __future__ import annotations

import hashlib
import hmac
import time
from typing import NoReturn
from urllib.parse import urlencode

from django.conf import settings
from rest_framework import status

from common.http import err
from core.models import Asset, AssetKind


def signed_url(asset: Asset, *, now: int | None = None) -> str:
    """Build a short-lived URL for a non-mask asset."""
    if asset.kind == AssetKind.MASK:
        err(
            "SIGNATURE_INVALID",
            status.HTTP_403_FORBIDDEN,
            "This asset cannot be accessed through a public media URL.",
        )

    issued_at = int(time.time()) if now is None else now
    expiration = issued_at + settings.MEDIA_URL_TTL_SECONDS
    signature = _signature(str(asset.id), expiration)
    query = urlencode({"exp": expiration, "sig": signature})
    return f"{settings.PUBLIC_BASE_URL}/api/v1/media/{asset.id}?{query}"


def thumb_url(asset: Asset, *, now: int | None = None) -> str:
    return f"{signed_url(asset, now=now)}&w=480"


def verify_signature(
    asset_id: str,
    expiration: str,
    signature: str,
    *,
    now: int | None = None,
) -> None:
    """Validate a signed media URL or raise the standard API error."""
    try:
        expiration_value = int(expiration)
    except (TypeError, ValueError):
        _invalid_signature()

    current_time = int(time.time()) if now is None else now
    if expiration_value < current_time:
        _invalid_signature()

    expected = _signature(asset_id, expiration_value)
    if not hmac.compare_digest(expected, signature):
        _invalid_signature()


def _signature(asset_id: str, expiration: int) -> str:
    message = f"{asset_id}:{expiration}".encode()
    secret = settings.SECRET_KEY.encode()
    return hmac.new(secret, message, hashlib.sha256).hexdigest()


def _invalid_signature() -> NoReturn:
    err(
        "SIGNATURE_INVALID",
        status.HTTP_403_FORBIDDEN,
        "The media URL is invalid or expired.",
    )