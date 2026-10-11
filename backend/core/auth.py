"""Auth0 JWT authentication — §9.5 step 2 of the master plan.

Verifies RS256 access tokens against the Auth0 JWKS, audience and issuer.
Identity is the token ``sub``. Dev bypass via X-Dev-User only when
DEBUG and AUTH_DEV_BYPASS are both true (curl/testing only — never the demo).
"""
from __future__ import annotations

import time

import jwt
import requests
from django.conf import settings
from django.utils.encoding import force_str
from rest_framework.authentication import BaseAuthentication, get_authorization_header

from core.exceptions import ApiError
from core.models import User

_JWKS_CACHE: dict = {}
_JWKS_TTL_SECONDS = 600


def _jwks_keys(domain: str, kid: str | None, _force_refresh: bool = False):
    now = time.time()
    entry = _JWKS_CACHE.get(domain)
    if entry is None or _force_refresh or now - entry["at"] > _JWKS_TTL_SECONDS:
        resp = requests.get(f"https://{domain}/.well-known/jwks.json", timeout=10)
        resp.raise_for_status()
        entry = {"at": now, "keys": resp.json().get("keys", [])}
        _JWKS_CACHE[domain] = entry
    keys = entry["keys"]
    if kid:
        matches = [k for k in keys if k.get("kid") == kid]
        if matches:
            return matches[0]
        # Unknown kid: the key set may have rotated — refetch once.
        if not _force_refresh:
            return _jwks_keys(domain, kid, _force_refresh=True)
        return None
    return keys[0] if keys else None


def _display_name_for_new_user(domain: str, token: str, sub: str) -> str:
    try:
        resp = requests.get(
            f"https://{domain}/userinfo",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5,
        )
        if resp.ok:
            data = resp.json()
            name = data.get("name") or data.get("nickname")
            if name:
                return str(name)[:40]
    except Exception:
        pass
    tail = "".join(ch for ch in sub if ch.isalnum())[-4:] or "xxxx"
    return f"Neighbor-{tail}"


class Auth0JWTAuthentication(BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request):
        # Dev bypass (never in the demo): X-Dev-User acts as dev|<name>.
        if settings.DEBUG and settings.AUTH_DEV_BYPASS:
            dev_user = request.headers.get("X-Dev-User")
            if dev_user:
                name = dev_user.strip()[:40] or "dev"
                user, created = User.objects.get_or_create(
                    auth0_sub=f"dev|{name}",
                    defaults={"display_name": name},
                )
                return (user, None)

        header = get_authorization_header(request).split()
        if not header:
            return None  # no credentials — views decide whether auth is required
        if len(header) != 2 or header[0].lower() != b"bearer":
            raise ApiError("AUTH_REQUIRED", "Malformed Authorization header.")
        token = force_str(header[1])

        try:
            unverified = jwt.get_unverified_header(token)
        except jwt.PyJWTError:
            raise ApiError("AUTH_REQUIRED", "Invalid token.")

        domain = settings.AUTH0_DOMAIN
        jwk_dict = _jwks_keys(domain, unverified.get("kid"))
        if not jwk_dict:
            raise ApiError("AUTH_REQUIRED", "Unknown signing key.")
        try:
            public_key = jwt.algorithms.RSAAlgorithm.from_jwk(jwk_dict)
            claims = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                audience=settings.AUTH0_AUDIENCE,
                issuer=f"https://{domain}/",
                leeway=30,
            )
        except jwt.PyJWTError:
            raise ApiError("AUTH_REQUIRED", "Token verification failed.")

        sub = claims.get("sub")
        if not sub:
            raise ApiError("AUTH_REQUIRED", "Token has no subject.")
        user, created = User.objects.get_or_create(auth0_sub=sub)
        if created:
            user.display_name = _display_name_for_new_user(domain, token, sub)
            user.save(update_fields=["display_name"])
        return (user, token)

    def authenticate_header(self, request):
        return 'Bearer realm="api"'
