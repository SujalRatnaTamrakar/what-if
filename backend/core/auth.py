import hashlib
from functools import lru_cache

import jwt
import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


User = get_user_model()


class Auth0JWTAuthentication(BaseAuthentication):
    """Authenticate local development users or verified Auth0 bearer tokens."""

    def authenticate(self, request):
        if settings.DEBUG and getattr(settings, "AUTH_DEV_BYPASS", False):
            dev_user = request.headers.get("X-Dev-User", "").strip()
            if dev_user:
                return _get_or_create_user(f"dev|{dev_user}"), None

        authorization = request.headers.get("Authorization", "")
        if not authorization:
            return None
        if not authorization.startswith("Bearer "):
            raise AuthenticationFailed("Invalid authorization header.")

        token = authorization[7:].strip()
        if not token:
            raise AuthenticationFailed("Invalid bearer token.")

        claims = _decode_token(token)
        subject = claims.get("sub")
        if not isinstance(subject, str) or not subject:
            raise AuthenticationFailed("Token subject is missing.")
        return _get_or_create_user(subject, token), claims

    def authenticate_header(self, request):  # type: ignore[reportIncompatibleMethodOverride]
        request.META.get("HTTP_AUTHORIZATION")
        return "Bearer"


def _decode_token(token: str) -> dict:
    try:
        key = _jwks_client().get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=settings.AUTH0_AUDIENCE,
            issuer=f"https://{settings.AUTH0_DOMAIN}/",
        )
    except (jwt.PyJWTError, requests.RequestException, ValueError) as exc:
        raise AuthenticationFailed("Invalid bearer token.") from exc


@lru_cache(maxsize=4)
def _jwks_client():
    if not settings.AUTH0_DOMAIN:
        raise AuthenticationFailed("Auth0 is not configured.")
    return jwt.PyJWKClient(
        f"https://{settings.AUTH0_DOMAIN}/.well-known/jwks.json",
        cache_keys=True,
        lifespan=600,
    )


def _get_or_create_user(subject: str, token: str | None = None):
    user, created = User.objects.get_or_create(auth0_sub=subject)
    if created:
        display_name = _auth0_display_name(token) if token else None
        suffix = hashlib.sha256(subject.encode("utf-8")).hexdigest()[:4]
        setattr(user, "display_name", display_name or f"Neighbor-{suffix}")
        user.save(update_fields=["display_name"])
    return user


def _auth0_display_name(token: str | None) -> str | None:
    if not token or not settings.AUTH0_DOMAIN:
        return None
    try:
        response = requests.get(
            f"https://{settings.AUTH0_DOMAIN}/userinfo",
            headers={"Authorization": f"Bearer {token}"},
            timeout=2,
        )
        response.raise_for_status()
        profile = response.json()
    except (requests.RequestException, ValueError):
        return None

    name = profile.get("name") or profile.get("nickname")
    if not isinstance(name, str):
        return None
    name = name.strip()[:40]
    return name or None
