"""Fallback chain provider for the agents module (§6.1 *_CHAIN).

When SCENE_PROVIDER (etc.) is ``fallback``, ``get_provider`` builds one of
these from the matching ``*_CHAIN`` env var, e.g.::

    SCENE_CHAIN=gemini,openai,ollama

Each leg is tried in order. Only TRANSIENT errors (see
``backend.common.errors.is_transient_provider_error``: 429/503/504, retired-
model 404s, timeouts, connection errors) move the chain to the next leg.
Validation errors, bad prompts and contract violations (InvalidProviderOutput
and friends) surface immediately — they are never retried on another leg.

On success the chain stamps the WINNING leg's name/model onto itself, so the
callers' ``scene.provider`` / ``review.provider`` metadata stays honest.
If every leg fails, a single ProviderUnavailable is raised with the
per-provider errors attached.
"""
from __future__ import annotations

from pathlib import Path

from backend.common.errors import (
    ProviderUnavailable,
    is_transient_provider_error,
)
from .base import LLMProvider

_ROLE_CHAIN_ENV = {
    "scene": "SCENE_CHAIN",
    "draft": "DRAFT_CHAIN",
    "review": "REVIEW_CHAIN",
}

_DEFAULT_CHAINS = {
    "scene": "gemini,openai,ollama",
    "draft": "gemini,openai,ollama",
    "review": "gemini,openai,ollama",
}


class FallbackProvider(LLMProvider):
    name = "fallback"
    model = ""

    def __init__(self, role: str, legs: list[LLMProvider]):
        if not legs:
            raise ValueError("FallbackProvider needs at least one leg")
        self.role = role
        self.legs = legs
        self.used: LLMProvider | None = None

    def generate_json(
        self,
        system: str,
        user: str,
        images: list[Path],
        schema: dict,
        timeout: int,
    ) -> dict:
        errors: list[str] = []
        for leg in self.legs:
            try:
                data = leg.generate_json(
                    system=system,
                    user=user,
                    images=images,
                    schema=schema,
                    timeout=timeout,
                )
            except Exception as e:
                if is_transient_provider_error(e):
                    errors.append(f"{leg.name}: {e}")
                    continue
                raise
            # Winner: report its real identity downstream.
            self.used = leg
            self.name = leg.name
            self.model = leg.model
            return data
        raise ProviderUnavailable(
            "All providers in the fallback chain failed for role "
            f"{self.role!r}: " + " | ".join(errors)
        )
