"""E14 support, E15 unsupport."""
import time

from django.db import IntegrityError, OperationalError, transaction
from django.db.models import F
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core import serializers
from core.exceptions import ApiError
from core.models import Proposal, Support
from core.permissions import require_auth
from core.services import events
from core.views.helpers import get_visible_proposal


@api_view(["POST", "DELETE"])
def support(request, proposal_id):
    user = require_auth(request)
    p, _viewer = get_visible_proposal(request, proposal_id)
    if p.status != "published":
        raise ApiError("INVALID_STATE", "Only published proposals can be supported.")
    if request.method == "DELETE":
        return _unsupport(request, p, user)
    return _support(request, p, user)


def _support(request, p: Proposal, user) -> Response:
    # Retry on sqlite writer-lock contention ("database is locked"): the loser
    # re-reads and finds the winner's committed row. On Postgres the
    # UNIQUE(proposal, user) constraint is the guard (IntegrityError path).
    last_exc = None
    for attempt in range(5):
        try:
            with transaction.atomic():
                locked = Proposal.objects.select_for_update().get(pk=p.pk)
                if locked.status != "published":
                    raise ApiError("INVALID_STATE", "Only published proposals can be supported.")
                _, created = Support.objects.get_or_create(proposal=locked, user=user)
                if created:
                    locked.support_count = F("support_count") + 1
                    locked.save(update_fields=["support_count"])
                    events.record("supported", proposal_id=str(locked.pk), user_id=str(user.id))
                locked.refresh_from_db()
            return Response(
                serializers.support_result_dict(
                    str(locked.pk), locked.support_count, already_supported=not created
                )
            )
        except IntegrityError:
            # Lost a race with another request — the UNIQUE(proposal, user)
            # constraint is the real guard.
            locked = Proposal.objects.get(pk=p.pk)
            return Response(
                serializers.support_result_dict(
                    str(locked.pk), locked.support_count, already_supported=True
                )
            )
        except OperationalError as exc:
            if "locked" not in str(exc).lower() or attempt == 4:
                raise
            last_exc = exc
            time.sleep(0.05 * (attempt + 1))
    raise last_exc  # pragma: no cover


def _unsupport(request, p: Proposal, user) -> Response:
    with transaction.atomic():
        locked = Proposal.objects.select_for_update().get(pk=p.pk)
        deleted, _ = Support.objects.filter(proposal=locked, user=user).delete()
        if deleted:
            locked.support_count = F("support_count") - 1
            locked.save(update_fields=["support_count"])
        locked.refresh_from_db()
        if locked.support_count < 0:
            locked.support_count = 0
            locked.save(update_fields=["support_count"])
    result = serializers.support_result_dict(str(locked.pk), locked.support_count, already_supported=False)
    result["viewerHasSupported"] = False
    return Response(result)
