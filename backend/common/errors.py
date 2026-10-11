"""Shared exception types. Mirrors §9.4 / §5.6 of the master plan.

Each exception carries a ``code`` matching an error code in the §5.6 table,
so P4's backend can translate them directly into the API error envelope.
Agents and imaging raise these — they never return partial or garbage data.
"""


class ProviderError(Exception):
    """Base class for all provider failures."""

    code = "INTERNAL"

    def __init__(self, message: str = "Provider error", *, code: str | None = None):
        super().__init__(message)
        if code is not None:
            self.code = code
        self.message = message


class ProviderUnavailable(ProviderError):
    """The provider could not be reached or is misconfigured. HTTP 503."""

    code = "PROVIDER_UNAVAILABLE"


class ProviderTimeout(ProviderError):
    """The provider did not answer within the timeout. HTTP 503."""

    code = "PROVIDER_TIMEOUT"


class InvalidProviderOutput(ProviderError):
    """The provider answered but the output failed validation twice. HTTP 502."""

    code = "INVALID_PROVIDER_OUTPUT"


class RenderFailed(ProviderError):
    """Image rendering failed (used by the imaging module)."""

    code = "RENDER_FAILED"


def is_transient_provider_error(exc: BaseException) -> bool:
    """True when a provider failure is worth retrying on the NEXT provider.

    The fallback chain (§6.1 *_CHAIN) only moves on for transient failures:
    HTTP 429 / 503 / 504, retired-model 404s, timeouts and connection errors
    (all raised as ProviderUnavailable / ProviderTimeout). Validation errors
    (400), bad prompts and contract violations (InvalidProviderOutput, and
    non-404 RenderFailed) must SURFACE — they are never retried elsewhere.
    """
    if isinstance(exc, (ProviderUnavailable, ProviderTimeout)):
        return True
    if isinstance(exc, RenderFailed):
        msg = str(exc).lower()
        return "404" in msg or "not found" in msg or "retired" in msg
    return False
