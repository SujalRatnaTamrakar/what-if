from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase


User = get_user_model()


class CoreApiTests(APITestCase):
    def test_health(self):
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"ok": True, "db": True})

    def test_config_does_not_expose_secrets(self):
        response = self.client.get("/api/v1/config")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["providers"]["prompt"], "fake")
        self.assertNotIn("DJANGO_SECRET_KEY", body)
        self.assertNotIn("DATABASE_URL", body)

    def test_me_requires_authentication(self):
        response = self.client.get("/api/v1/me")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "AUTH_REQUIRED")

    @override_settings(DEBUG=True, AUTH_DEV_BYPASS=True)
    def test_dev_user_is_created_and_reused(self):
        response = self.client.get(
            "/api/v1/me",
            HTTP_X_DEV_USER="alice",
        )
        self.assertEqual(response.status_code, 200)
        first = response.json()

        response = self.client.get(
            "/api/v1/me",
            HTTP_X_DEV_USER="alice",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], first["id"])
        self.assertEqual(
            User.objects.filter(auth0_sub="dev|alice").count(),
            1,
        )

    @override_settings(DEBUG=True, AUTH_DEV_BYPASS=True)
    def test_display_name_validation(self):
        response = self.client.patch(
            "/api/v1/me",
            {"displayName": "A"},
            format="json",
            HTTP_X_DEV_USER="alice",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "VALIDATION_ERROR")
