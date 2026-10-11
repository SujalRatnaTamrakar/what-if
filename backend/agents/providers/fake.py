"""Fake provider (§10.4): deterministic, schema-valid data with
provider="fake", so the backend and mobile can run without models."""
from __future__ import annotations

from pathlib import Path

from backend.agents.schemas import utc_now_z
from .base import LLMProvider


def scene_data() -> dict:
    return {
        "summary": "Bus stop with a bench and no overhead cover on a sunny sidewalk.",
        "observations": [
            "Bench without overhead cover",
            "Wide sidewalk behind bench",
        ],
        "uncertainties": [
            {
                "id": "u1",
                "question": "Is the area behind the bench public right-of-way?",
            }
        ],
        "preserve": ["bus stop sign", "road markings", "storefronts"],
        "options": [
            {
                "id": "shade_canopy",
                "category": "shade",
                "title": "Freestanding shade canopy over the bench",
                "description": "A slim steel-post canopy covering the existing bench area.",
                "editGoal": "Add a freestanding shade canopy above the bench; keep sidewalk, sign and road unchanged.",
                "maskHint": "Brush the area above and around the bench.",
                "requestDraft": "Please consider installing a shade canopy at this bus stop...",
            },
            {
                "id": "shade_sail",
                "category": "shade",
                "title": "Tensioned shade sail over the bench",
                "description": "A fabric shade sail on slim posts over the bench area.",
                "editGoal": "Add a tensioned fabric shade sail above the bench; keep sidewalk, sign and road unchanged.",
                "maskHint": "Brush the area above and around the bench.",
                "requestDraft": "Please consider installing a shade sail at this bus stop...",
            },
        ],
        "provider": "fake",
        "model": "fake",
        "analyzedAt": utc_now_z(),
    }


def review_data() -> dict:
    return {
        "verdict": "needs_review",
        "flags": [
            {
                "id": "f1",
                "code": "IMPLAUSIBLE_STRUCTURE",
                "severity": "warning",
                "message": "Canopy posts appear to float above the pavement.",
            }
        ],
        "outsideMaskChange": 0.012,
        "provider": "fake",
        "model": "fake",
        "reviewedAt": utc_now_z(),
    }


def draft_data() -> dict:
    return {
        "title": "Shade canopy for the bus stop",
        "changeRequest": (
            "Please consider installing a shade canopy at this bus stop to protect "
            "waiting riders from the afternoon sun. This image is an AI illustration, "
            "not a design."
        ),
    }


_KINDS = {"scene": scene_data, "review": review_data, "draft": draft_data}


class FakeProvider(LLMProvider):
    """Deterministic provider. ``kind`` is one of scene/review/draft."""

    name = "fake"
    model = "fake"
    timeout = 5

    def __init__(self, kind: str = "scene"):
        if kind not in _KINDS:
            raise ValueError(f"Unknown fake kind: {kind}")
        self.kind = kind

    def generate_json(
        self,
        system: str,
        user: str,
        images: list[Path],
        schema: dict,
        timeout: int,
    ) -> dict:
        return _KINDS[self.kind]()
