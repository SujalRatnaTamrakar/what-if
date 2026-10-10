from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.http import err
from core.serializers import me_payload


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user

    if request.method == "GET":
        return Response(me_payload(user))

    display_name = request.data.get("displayName")
    if not isinstance(display_name, str):
        err(
            "VALIDATION_ERROR",
            status.HTTP_400_BAD_REQUEST,
            "displayName is required.",
            fields={"displayName": ["This field is required."]},
        )

    display_name = display_name.strip()
    if not 2 <= len(display_name) <= 40:
        err(
            "VALIDATION_ERROR",
            status.HTTP_400_BAD_REQUEST,
            "displayName must be between 2 and 40 characters.",
            fields={"displayName": ["Use between 2 and 40 characters."]},
        )

    user.display_name = display_name
    user.save(update_fields=["display_name"])
    return Response(me_payload(user))
