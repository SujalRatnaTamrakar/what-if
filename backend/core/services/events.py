import logging
from typing import Any

from core.models import Event, Post, User


logger = logging.getLogger(__name__)


def record(
    event_type: str,
    *,
    post: Post | None = None,
    user: User | None = None,
    data: dict[str, Any] | None = None,
) -> Event | None:
    """Record an analytics event without interrupting the main request."""
    from django.conf import settings

    if not settings.ANALYTICS_ENABLED:
        return None

    try:
        return Event.objects.create(
            type=event_type,
            post=post,
            user=user,
            data=data or {},
        )
    except Exception:
        logger.exception("Failed to record analytics event", extra={"event_type": event_type})
        return None