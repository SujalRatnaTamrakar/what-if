"""Error classes. Uses P4's common.errors when present, else local stand-ins with the same names/codes."""
try:  # pragma: no cover
    from common.errors import ProviderUnavailable, ProviderTimeout, RenderFailed, InvalidProviderOutput  # type: ignore
except ImportError:
    class ProviderError(Exception):
        code = "INTERNAL"
        retryable = True

    class ProviderUnavailable(ProviderError):
        code = "PROVIDER_UNAVAILABLE"

    class ProviderTimeout(ProviderError):
        code = "PROVIDER_TIMEOUT"

    class InvalidProviderOutput(ProviderError):
        code = "INVALID_PROVIDER_OUTPUT"

    class RenderFailed(ProviderError):
        code = "RENDER_FAILED"
