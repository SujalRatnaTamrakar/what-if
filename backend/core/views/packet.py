"""E16 packet export, E18 packet PDF bytes."""
from django.db import transaction
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core import serializers
from core.exceptions import ApiError
from core.models import Packet
from core.services import events
from core.services.packet_pdf import build_packet
from core.views.helpers import get_visible_proposal


@api_view(["POST"])
def export_packet(request, proposal_id):
    p, _viewer = get_visible_proposal(request, proposal_id)
    if p.status != "published":
        raise ApiError("INVALID_STATE", "Only published proposals can be exported.")
    _out, rel = build_packet(p, p.support_count)
    with transaction.atomic():
        packet = Packet.objects.create(
            proposal=p, file_path=rel, support_count_at_export=p.support_count
        )
    events.record("packet_exported", proposal_id=str(p.id))
    return Response(serializers.packet_dict(packet))
