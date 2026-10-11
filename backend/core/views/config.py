"""E2 config."""
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core import serializers


@api_view(["GET"])
def public_config(request):
    return Response(serializers.public_config_dict())
