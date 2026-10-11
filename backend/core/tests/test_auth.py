from unittest.mock import Mock, patch
from typing import cast

import jwt
from django.test import TestCase, override_settings
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.test import APIRequestFactory

from core.auth import Auth0JWTAuthentication
from core.models import User


class Auth0AuthenticationTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.authentication = Auth0JWTAuthentication()

    @override_settings(
        DEBUG=False,
        AUTH0_DOMAIN="whatif.us.auth0.com",
        AUTH0_AUDIENCE="https://api.whatif.dev",
    )
    @patch("core.auth._jwks_client")
    @patch("core.auth.jwt.decode")
    def test_valid_bearer_token_creates_user_from_userinfo(
        self,
        decode,
        jwks_client,
    ):
        signing_key = Mock()
        signing_key.key = "public-key"
        jwks_client.return_value.get_signing_key_from_jwt.return_value = signing_key
        decode.return_value = {"sub": "auth0|123"}

        request = self.factory.get(
            "/api/v1/me",
            HTTP_AUTHORIZATION="Bearer valid-token",
        )
        with patch("core.auth.requests.get") as get:
            profile_response = Mock()
            profile_response.json.return_value = {"name": "Auth0 Person"}
            get.return_value = profile_response
            result = self.authentication.authenticate(request)

        self.assertIsNotNone(result)
        user, claims = cast(tuple[User, dict | None], result)
        self.assertEqual(user.auth0_sub, "auth0|123")
        self.assertEqual(user.display_name, "Auth0 Person")
        self.assertEqual(claims, {"sub": "auth0|123"})
        decode.assert_called_once_with(
            "valid-token",
            "public-key",
            algorithms=["RS256"],
            audience="https://api.whatif.dev",
            issuer="https://whatif.us.auth0.com/",
        )

    @override_settings(DEBUG=False, AUTH0_DOMAIN="whatif.us.auth0.com")
    @patch("core.auth._jwks_client")
    def test_invalid_token_raises_authentication_failed(self, jwks_client):
        jwks_client.return_value.get_signing_key_from_jwt.side_effect = jwt.InvalidTokenError(
            "bad token",
        )
        request = self.factory.get(
            "/api/v1/me",
            HTTP_AUTHORIZATION="Bearer invalid-token",
        )

        with self.assertRaises(AuthenticationFailed):
            self.authentication.authenticate(request)

    @override_settings(DEBUG=False)
    def test_missing_credentials_returns_anonymous(self):
        request = self.factory.get("/api/v1/me")

        self.assertIsNone(self.authentication.authenticate(request))

    @override_settings(DEBUG=True, AUTH_DEV_BYPASS=True)
    def test_development_bypass_remains_available(self):
        request = self.factory.get(
            "/api/v1/me",
            HTTP_X_DEV_USER="local-user",
        )

        result = self.authentication.authenticate(request)

        self.assertIsNotNone(result)
        user, claims = cast(tuple[User, dict | None], result)
        self.assertEqual(user.auth0_sub, "dev|local-user")
        self.assertIsNone(claims)
        self.assertTrue(User.objects.filter(auth0_sub="dev|local-user").exists())
