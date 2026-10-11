from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def public_config(request):
    return Response(
        {
            "apiVersion": "1",
            "maxUploadBytes": settings.MAX_UPLOAD_BYTES,
            "maxImageEdge": settings.MAX_IMAGE_EDGE,
            "promptMinChars": settings.PROMPT_MIN_CHARS,
            "promptMaxChars": settings.PROMPT_MAX_CHARS,
            "localRadiusKm": settings.LOCAL_RADIUS_KM,
            "localRadiusMaxKm": settings.LOCAL_RADIUS_MAX_KM,
            "aiDisclosure": settings.AI_DISCLOSURE,
            "providers": {
                "prompt": settings.PROMPT_PROVIDER,
                "render": settings.RENDER_PROVIDER,
                "review": settings.REVIEW_PROVIDER,
            },
        }
    )
