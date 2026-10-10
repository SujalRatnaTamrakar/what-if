import hashlib

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication


User = get_user_model()


class Auth0JWTAuthentication(BaseAuthentication):
    """Authenticate local development users until Auth0 JWT verification is added."""

    def authenticate(self, request):
        if not (
            settings.DEBUG
            and getattr(settings, "AUTH_DEV_BYPASS", False)
        ):
            return None

        dev_user = request.headers.get("X-Dev-User", "").strip()
        if not dev_user:
            return None

        auth0_sub = f"dev|{dev_user}"
        suffix = hashlib.sha256(auth0_sub.encode("utf-8")).hexdigest()[:4]
        user, _ = User.objects.get_or_create(
            auth0_sub=auth0_sub,
            defaults={"display_name": f"Neighbor-{suffix}"},
        )
        return user, None

    def authenticate_header(self, request):
        return "Bearer"
