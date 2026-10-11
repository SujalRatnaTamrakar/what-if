"""HMAC-signed URLs for media and packets (§2/§5.4 E17–E18).

Signature covers ``<kind>|<id>|<exp>`` with the Django SECRET_KEY.
Clients must never receive raw file paths.
"""
from __future__ import annotations

import hashlib
import hmac
import time

from django.conf import settings

from core.exceptions import ApiError


def _sig(payload: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256
    ).hexdigest()


def _expires_at() -> int:
    return int(time.time()) + int(settings.MEDIA_URL_TTL_SECONDS)


def sign_id(kind: str, obj_id: str, exp: int) -> str:
    return _sig(f"{kind}|{obj_id}|{exp}")


def verify_id(kind: str, obj_id: str, exp: str | int, sig: str) -> None:
    """Raise SIGNATURE_INVALID when the signature is bad or expired."""
    try:
        exp_int = int(exp)
    except (TypeError, ValueError):
        raise ApiError("SIGNATURE_INVALID")
    if exp_int < int(time.time()):
        raise ApiError("SIGNATURE_INVALID", "This link has expired.")
    expected = sign_id(kind, str(obj_id), exp_int)
    if not hmac.compare_digest(expected, str(sig or "")):
        raise ApiError("SIGNATURE_INVALID")


def media_url(asset_id: str) -> tuple[str, int]:
    exp = _expires_at()
    sig = sign_id("media", str(asset_id), exp)
    return f"{settings.PUBLIC_BASE_URL}/api/v1/media/{asset_id}?exp={exp}&sig={sig}", exp


def packet_url(packet_id: str) -> tuple[str, int]:
    exp = _expires_at()
    sig = sign_id("packet", str(packet_id), exp)
    return (
        f"{settings.PUBLIC_BASE_URL}/api/v1/packets/{packet_id}.pdf?exp={exp}&sig={sig}",
        exp,
    )
