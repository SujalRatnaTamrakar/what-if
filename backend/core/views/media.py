from pathlib import Path

from django.conf import settings
from django.http import FileResponse
from rest_framework import status
from rest_framework.decorators import api_view

from common.http import err
from core.models import Asset, AssetKind
from core.services.signing import verify_signature


@api_view(["GET"])
def media(request, asset_id):
    asset = Asset.objects.filter(id=asset_id).first()
    if asset is None:
        err(
            "NOT_FOUND",
            status.HTTP_404_NOT_FOUND,
            "Media asset not found.",
        )

    if asset.kind == AssetKind.MASK:
        user = request.user
        post_id = getattr(asset, "post_id", None)
        if not getattr(user, "is_authenticated", False) or post_id is None:
            err(
                "SIGNATURE_INVALID",
                status.HTTP_403_FORBIDDEN,
                "The media URL is invalid or expired.",
            )
        post = asset.post
        if post is None or getattr(post, "owner_id") != user.pk:
            err(
                "SIGNATURE_INVALID",
                status.HTTP_403_FORBIDDEN,
                "The media URL is invalid or expired.",
            )

    verify_signature(
        str(asset.pk),
        request.query_params.get("exp", ""),
        request.query_params.get("sig", ""),
    )

    media_root = Path(settings.MEDIA_ROOT).resolve()
    file_path = (media_root / asset.file_path).resolve()
    if media_root not in file_path.parents or not file_path.is_file():
        err(
            "NOT_FOUND",
            status.HTTP_404_NOT_FOUND,
            "Media asset not found.",
        )

    response = FileResponse(
        file_path.open("rb"),
        content_type=asset.mime_type,
    )
    response["Cache-Control"] = "private, max-age=300"
    return response
