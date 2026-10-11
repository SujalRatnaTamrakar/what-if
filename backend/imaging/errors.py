"""Error types for the imaging module.

Canonical definitions live in ``backend/common/errors.py`` (P4 owns it);
this module re-exports them so there is exactly ONE class identity for each
error, no matter which import path a caller uses. The local fallback classes
below only exist for standalone use before backend/common exists.
"""

try:  # canonical path
    from backend.common.errors import (  # type: ignore
        ProviderError,
        ProviderUnavailable,
        ProviderTimeout,
        InvalidProviderOutput,
        RenderFailed,
        is_transient_provider_error,
    )
except Exception:  # backend/common/errors.py does not exist yet

    class ProviderError(Exception):
        """Base for all provider failures. Carries the §5.6 envelope code."""

        code = "INTERNAL"
        http_status = 500
        retryable = True

    class ProviderUnavailable(ProviderError):
        code = "PROVIDER_UNAVAILABLE"
        http_status = 503
        retryable = True

    class ProviderTimeout(ProviderError):
        code = "PROVIDER_TIMEOUT"
        http_status = 503
        retryable = True

    class InvalidProviderOutput(ProviderError):
        code = "INVALID_PROVIDER_OUTPUT"
        http_status = 502
        retryable = True

    class RenderFailed(ProviderError):
        code = "RENDER_FAILED"
        http_status = 500
        retryable = True

    def is_transient_provider_error(exc: BaseException) -> bool:  # noqa: F811
        if isinstance(exc, (ProviderUnavailable, ProviderTimeout)):
            return True
        if isinstance(exc, RenderFailed):
            msg = str(exc).lower()
            return "404" in msg or "not found" in msg or "retired" in msg
        return False


__all__ = [
    "ProviderError",
    "ProviderUnavailable",
    "ProviderTimeout",
    "InvalidProviderOutput",
    "RenderFailed",
    "is_transient_provider_error",
]
