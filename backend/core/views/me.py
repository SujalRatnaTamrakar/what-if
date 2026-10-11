"""E3 GET /me, E4 PATCH /me."""
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core import serializers
from core.exceptions import ApiError
from core.permissions import require_auth


@api_view(["GET", "PATCH"])
def me(request):
    user = require_auth(request)
    if request.method == "PATCH":
        name = request.data.get("displayName")
        if not isinstance(name, str) or not (1 <= len(name.strip()) <= 40):
            raise ApiError(
                "VALIDATION_ERROR",
                field_errors={"displayName": ["Must be 1–40 characters."]},
            )
        user.display_name = name.strip()
        user.save(update_fields=["display_name"])
    return Response(serializers.me_dict(user))
