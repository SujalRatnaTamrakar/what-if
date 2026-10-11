"""API error envelope — §5.6 of the master plan.

Every error response has the shape {"error": {code, message, retryable, fieldErrors?}}.
"""
from __future__ import annotations

from rest_framework import status as http_status
from rest_framework.exceptions import (
    AuthenticationFailed,
    NotAuthenticated,
    NotFound,
    PermissionDenied,
    Throttled,
    ValidationError as DRFValidationError,
)
from rest_framework.response import Response


# Human-readable messages aligned with the §5.6 "Client behavior" column.
_MESSAGES = {
    "AUTH_REQUIRED": "Sign in to continue.",
    "NOT_FOUND": "Not found.",
    "VALIDATION_ERROR": "Some fields need attention.",
    "CONSENT_REQUIRED": "Please confirm the photo consent checkbox.",
    "APPROVAL_REQUIRED": "Both approval checkboxes are required.",
    "UNSUPPORTED_IMAGE": "Use a JPEG, PNG, HEIC or WEBP photo.",
    "IMAGE_TOO_LARGE": "Photo is too large (max 15 MB).",
    "MASK_EMPTY": "Brush the area to change.",
    "MASK_TOO_LARGE": "Brush a smaller area (max 60% of the photo).",
    "MASK_SIZE_MISMATCH": "Mask size does not match the photo; re-export the mask.",
    "REVISION_CONFLICT": "This proposal changed. Reload it.",
    "INVALID_STATE": "That action is not available right now. Reload the proposal.",
    "JOB_IN_PROGRESS": "A job is already running for this proposal.",
    "REVIEW_BLOCKED": "This concept can't be published. Regenerate the concept.",
    "FLAGS_NOT_ACKNOWLEDGED": "Please acknowledge every review warning.",
    "SIGNATURE_INVALID": "This link expired or is invalid. Reload for a fresh link.",
    "RATE_LIMITED": "Too many requests. Back off and retry.",
    "PROVIDER_UNAVAILABLE": "An AI service is unavailable. Try again.",
    "PROVIDER_TIMEOUT": "An AI service timed out. Try again.",
    "INVALID_PROVIDER_OUTPUT": "An AI service returned an unusable result. Try again.",
    "RENDER_FAILED": "Rendering failed. Adjust the brushed area and retry.",
    "STALE_RESULT": "The proposal changed while the job ran; the result was discarded. Reload.",
    "INTERNAL": "Something went wrong. Try again.",
}

_RETRYABLE_DEFAULTS = {
    "AUTH_REQUIRED": False,
    "NOT_FOUND": False,
    "VALIDATION_ERROR": False,
    "CONSENT_REQUIRED": False,
    "APPROVAL_REQUIRED": False,
    "UNSUPPORTED_IMAGE": False,
    "IMAGE_TOO_LARGE": False,
    "MASK_EMPTY": False,
    "MASK_TOO_LARGE": False,
    "MASK_SIZE_MISMATCH": False,
    "REVISION_CONFLICT": False,
    "INVALID_STATE": False,
    "JOB_IN_PROGRESS": True,
    "REVIEW_BLOCKED": False,
    "FLAGS_NOT_ACKNOWLEDGED": False,
    "SIGNATURE_INVALID": True,
    "RATE_LIMITED": True,
    "PROVIDER_UNAVAILABLE": True,
    "PROVIDER_TIMEOUT": True,
    "INVALID_PROVIDER_OUTPUT": True,
    "RENDER_FAILED": True,
    "STALE_RESULT": False,
    "INTERNAL": True,
}

_HTTP_DEFAULTS = {
    "AUTH_REQUIRED": http_status.HTTP_401_UNAUTHORIZED,
    "NOT_FOUND": http_status.HTTP_404_NOT_FOUND,
    "VALIDATION_ERROR": http_status.HTTP_400_BAD_REQUEST,
    "CONSENT_REQUIRED": http_status.HTTP_400_BAD_REQUEST,
    "APPROVAL_REQUIRED": http_status.HTTP_400_BAD_REQUEST,
    "UNSUPPORTED_IMAGE": http_status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
    "IMAGE_TOO_LARGE": http_status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
    "MASK_EMPTY": http_status.HTTP_400_BAD_REQUEST,
    "MASK_TOO_LARGE": http_status.HTTP_400_BAD_REQUEST,
    "MASK_SIZE_MISMATCH": http_status.HTTP_400_BAD_REQUEST,
    "REVISION_CONFLICT": http_status.HTTP_409_CONFLICT,
    "INVALID_STATE": http_status.HTTP_409_CONFLICT,
    "JOB_IN_PROGRESS": http_status.HTTP_409_CONFLICT,
    "REVIEW_BLOCKED": http_status.HTTP_409_CONFLICT,
    "FLAGS_NOT_ACKNOWLEDGED": http_status.HTTP_409_CONFLICT,
    "SIGNATURE_INVALID": http_status.HTTP_403_FORBIDDEN,
    "RATE_LIMITED": http_status.HTTP_429_TOO_MANY_REQUESTS,
    "PROVIDER_UNAVAILABLE": http_status.HTTP_503_SERVICE_UNAVAILABLE,
    "PROVIDER_TIMEOUT": http_status.HTTP_503_SERVICE_UNAVAILABLE,
    "INVALID_PROVIDER_OUTPUT": http_status.HTTP_502_BAD_GATEWAY,
    "RENDER_FAILED": http_status.HTTP_502_BAD_GATEWAY,
    "STALE_RESULT": http_status.HTTP_409_CONFLICT,
    "INTERNAL": http_status.HTTP_500_INTERNAL_SERVER_ERROR,
}


class ApiError(Exception):
    """Raise with a §5.6 code; the handler renders the envelope."""

    def __init__(self, code: str, message: str | None = None, *,
                 http_status_code: int | None = None,
                 retryable: bool | None = None,
                 field_errors: dict | None = None):
        super().__init__(message or _MESSAGES.get(code, code))
        self.code = code
        self.message = message or _MESSAGES.get(code, code)
        self.http_status_code = http_status_code if http_status_code is not None else _HTTP_DEFAULTS.get(code, 500)
        self.retryable = _RETRYABLE_DEFAULTS.get(code, False) if retryable is None else retryable
        self.field_errors = field_errors

    def envelope(self) -> dict:
        err = {"code": self.code, "message": self.message, "retryable": self.retryable}
        if self.field_errors:
            err["fieldErrors"] = self.field_errors
        return {"error": err}


def _flatten_field_errors(detail) -> dict:
    out: dict[str, list[str]] = {}
    if isinstance(detail, dict):
        for k, v in detail.items():
            out[str(k)] = [str(x) for x in v] if isinstance(v, (list, tuple)) else [str(v)]
    return out


def handler(exc, context):
    """DRF EXCEPTION_HANDLER — everything becomes the §5.6 envelope."""
    if isinstance(exc, ApiError):
        return Response(exc.envelope(), status=exc.http_status_code)

    if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
        e = ApiError("AUTH_REQUIRED")
        return Response(e.envelope(), status=e.http_status_code)
    if isinstance(exc, PermissionDenied):
        # Never 403 for resource visibility — drafts read as 404 (§5.4 E7).
        e = ApiError("NOT_FOUND", "Not found or not yours.")
        return Response(e.envelope(), status=e.http_status_code)
    if isinstance(exc, Throttled):
        e = ApiError("RATE_LIMITED")
        return Response(e.envelope(), status=e.http_status_code)
    if isinstance(exc, DRFValidationError):
        e = ApiError("VALIDATION_ERROR", field_errors=_flatten_field_errors(exc.detail))
        return Response(e.envelope(), status=e.http_status_code)
    if isinstance(exc, NotFound):
        e = ApiError("NOT_FOUND")
        return Response(e.envelope(), status=e.http_status_code)

    # Lazy import: rest_framework.views pulls a heavy chain (schemas/openapi)
    # that must not be imported at module load time (circular import).
    from rest_framework.views import exception_handler as drf_exception_handler

    response = drf_exception_handler(exc, context)
    if response is not None:
        return response

    # Last resort: never leak a traceback or HTML page to the client.
    import logging
    logging.getLogger(__name__).exception("Unhandled exception in API")
    e = ApiError("INTERNAL")
    return Response(e.envelope(), status=e.http_status_code)
