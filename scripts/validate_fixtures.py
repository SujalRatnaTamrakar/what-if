#!/usr/bin/env python3
"""Validate shared JSON fixtures against OpenAPI component schemas."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import jsonschema
import yaml


ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "shared" / "contract" / "openapi.yaml"
FIXTURES_DIR = ROOT / "shared" / "fixtures"
SCHEMA_BY_FIXTURE = {
    "config.json": "PublicConfig",
    "me.json": "Me",
    "post_draft.json": "Post",
    "post_ready.json": "Post",
    "post_published.json": "Post",
    "mask_saved.json": "MaskSaved",
    "error_revision_conflict.json": "ErrorEnvelope",
    "error_auth_required.json": "ErrorEnvelope",
}


def load_contract() -> dict[str, Any]:
    return yaml.safe_load(CONTRACT_PATH.read_text())


def validate_fixture(
    fixture_path: Path,
    schema_name: str,
    contract: dict[str, Any],
) -> None:
    payload = json.loads(fixture_path.read_text())
    schema = contract["components"]["schemas"][schema_name]
    resolver = jsonschema.RefResolver.from_schema(contract)
    jsonschema.Draft202012Validator(schema, resolver=resolver).validate(payload)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "fixture",
        nargs="*",
        help="Fixture filename(s), defaulting to every registered fixture.",
    )
    args = parser.parse_args()

    names = args.fixture or sorted(SCHEMA_BY_FIXTURE)
    unknown = [name for name in names if name not in SCHEMA_BY_FIXTURE]
    if unknown:
        print(f"Unknown fixture(s): {', '.join(unknown)}", file=sys.stderr)
        return 2

    contract = load_contract()
    failures = 0
    for name in names:
        path = FIXTURES_DIR / name
        try:
            validate_fixture(path, SCHEMA_BY_FIXTURE[name], contract)
        except (OSError, json.JSONDecodeError, jsonschema.ValidationError) as exc:
            print(f"FAIL {name}: {exc}", file=sys.stderr)
            failures += 1
        else:
            print(f"OK   {name}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
