#!/usr/bin/env python3
"""Validate every fixture JSON against the matching component schema in
shared/contract/openapi.yaml. Exits nonzero with a clear message on failure.

Usage: python3 scripts/validate_fixtures.py
Run from the repo root.
"""
import json
import sys
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent.parent
SPEC = ROOT / "shared" / "contract" / "openapi.yaml"
FIXTURES = ROOT / "shared" / "fixtures"

# fixture filename -> component schema name
MAPPING = {
    "config.json": "PublicConfig",
    "me.json": "Me",
    "proposal_created.json": "ProposalCreateResponse",
    "job_scene_running.json": "Job",
    "job_scene_succeeded.json": "Job",
    "proposal_with_scene.json": "Proposal",
    "mask_saved.json": "MaskSaved",
    "preview_accepted.json": "JobAccepted",
    "job_preview_render.json": "Job",
    "job_preview_succeeded.json": "Job",
    "job_preview_failed.json": "Job",
    "proposal_ready.json": "Proposal",
    "proposal_ready_blocked.json": "Proposal",
    "proposal_published.json": "Proposal",
    "support_first.json": "SupportResult",
    "support_repeat.json": "SupportResult",
    "packet.json": "Packet",
    "feed_public.json": "ProposalListPage",
    "feed_mine.json": "ProposalListPage",
    "error_revision_conflict.json": "ErrorBody",
    "error_provider_unavailable.json": "ErrorBody",
    "error_auth_required.json": "ErrorBody",
}


def main() -> int:
    spec = yaml.safe_load(SPEC.read_text())
    schemas = spec["components"]["schemas"]
    failures = []
    checked = 0

    for filename, schema_name in sorted(MAPPING.items()):
        path = FIXTURES / filename
        if not path.exists():
            failures.append(f"{filename}: MISSING FILE")
            continue
        if schema_name not in schemas:
            failures.append(f"{filename}: schema '{schema_name}' not in openapi.yaml")
            continue
        data = json.loads(path.read_text())
        validator = Draft202012Validator(_resolve(spec, schema_name))
        errors = sorted(validator.iter_errors(data), key=lambda e: list(e.path))
        if errors:
            for e in errors:
                loc = "/".join(str(p) for p in e.path) or "(root)"
                failures.append(f"{filename}: {loc}: {e.message}")
        else:
            checked += 1

    # Also confirm the images exist (not validated, just present)
    for img in ("images/source.jpg", "images/concept.jpg"):
        if not (FIXTURES / img).exists():
            failures.append(f"{img}: MISSING FILE")
        else:
            checked += 1

    if failures:
        print(f"FAILED: {len(failures)} problem(s), {checked} fixture(s) OK")
        for f in failures:
            print("  -", f)
        return 1
    print(f"OK: all {checked} fixtures validate against shared/contract/openapi.yaml")
    return 0


def _resolve(spec: dict, name: str) -> dict:
    """Inline-resolve local $refs so jsonschema sees a self-contained schema."""
    schemas = spec["components"]["schemas"]

    def resolve(node):
        if isinstance(node, dict):
            if set(node.keys()) == {"$ref"} and node["$ref"].startswith("#/components/schemas/"):
                return resolve(schemas[node["$ref"].rsplit("/", 1)[1]])
            return {k: resolve(v) for k, v in node.items()}
        if isinstance(node, list):
            return [resolve(v) for v in node]
        return node

    return resolve(schemas[name])


if __name__ == "__main__":
    sys.exit(main())
