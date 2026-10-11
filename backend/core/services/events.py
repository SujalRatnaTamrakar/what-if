"""Analytics events — §9.4/§9.5. Never raises; no-op when disabled."""
from __future__ import annotations

import logging

from django.conf import settings

log = logging.getLogger(__name__)


def record(event_type: str, *, proposal_id=None, user_id=None, data: dict | None = None) -> None:
    if not settings.ANALYTICS_ENABLED:
        return
    try:
        from core.models import Event

        Event.objects.create(
            type=event_type,
            proposal_id=proposal_id,
            user_id=user_id,
            data=data or {},
        )
    except Exception:
        log.exception("events.record failed (non-fatal)")
