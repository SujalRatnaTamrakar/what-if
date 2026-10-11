"""E17 signed media bytes, E18 signed packet PDF bytes."""
from pathlib import Path

from django.conf import settings
from django.http import FileResponse
from rest_framework.decorators import api_view

from core.exceptions import ApiError
from core.models import Asset, Packet
from core.services import signing


@api_view(["GET"])
def serve_media(request, asset_id):
    signing.verify_id("media", str(asset_id), request.query_params.get("exp"), request.query_params.get("sig"))
    try:
        asset = Asset.objects.get(pk=asset_id)
    except Asset.DoesNotExist:
        raise ApiError("NOT_FOUND")
    rel = asset.file_path
    if request.query_params.get("thumb") == "1" and asset.thumb_path:
        rel = asset.thumb_path
    full = Path(settings.MEDIA_ROOT) / rel
    if not full.is_file():
        raise ApiError("NOT_FOUND")
    resp = FileResponse(open(full, "rb"), content_type=asset.mime_type or "application/octet-stream")
    resp["Cache-Control"] = "private, max-age=300"
    return resp


@api_view(["GET"])
def serve_packet(request, packet_id):
    signing.verify_id("packet", str(packet_id), request.query_params.get("exp"), request.query_params.get("sig"))
    try:
        packet = Packet.objects.get(pk=packet_id)
    except Packet.DoesNotExist:
        raise ApiError("NOT_FOUND")
    full = Path(settings.MEDIA_ROOT) / packet.file_path
    if not full.is_file():
        raise ApiError("NOT_FOUND")
    resp = FileResponse(open(full, "rb"), content_type="application/pdf")
    resp["Cache-Control"] = "private, max-age=300"
    return resp
