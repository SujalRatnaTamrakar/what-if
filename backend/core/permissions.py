"""Small permission helpers."""
from core.exceptions import ApiError


def require_auth(request):
    """Return request.user or raise 401 AUTH_REQUIRED."""
    user = getattr(request, "user", None)
    if user is None or not getattr(user, "is_authenticated", False):
        raise ApiError("AUTH_REQUIRED")
    return user


def try_auth(request):
    """Best-effort auth for public endpoints that enrich when logged in."""
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        return user
    return None
