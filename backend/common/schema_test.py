from __future__ import annotations

from pathlib import Path
from typing import Any

import jsonschema
import yaml


CONTRACT_PATH = (
    Path(__file__).resolve().parents[2] / "shared" / "contract" / "openapi.yaml"
)


def assert_matches_schema(payload: Any, component_name: str) -> None:
    contract = yaml.safe_load(CONTRACT_PATH.read_text())
    schema = contract["components"]["schemas"][component_name]
    resolver = jsonschema.RefResolver.from_schema(contract)
    jsonschema.Draft202012Validator(schema, resolver=resolver).validate(payload)
