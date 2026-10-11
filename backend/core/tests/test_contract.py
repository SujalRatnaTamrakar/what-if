from django.test import TestCase
from rest_framework.test import APIClient

from common.schema_test import assert_matches_schema


class ContractSmokeTests(TestCase):
    def test_config_response_matches_contract(self):
        response = APIClient().get("/api/v1/config")

        self.assertEqual(response.status_code, 200)
        assert_matches_schema(response.json(), "PublicConfig")
