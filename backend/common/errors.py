class ProviderError(Exception):
    code = "PROVIDER_UNAVAILABLE"
    retryable = True


class ProviderUnavailable(ProviderError):
    code = "PROVIDER_UNAVAILABLE"


class ProviderTimeout(ProviderError):
    code = "PROVIDER_TIMEOUT"


class InvalidProviderOutput(ProviderError):
    code = "INVALID_PROVIDER_OUTPUT"


class RenderFailed(ProviderError):
    code = "RENDER_FAILED"
