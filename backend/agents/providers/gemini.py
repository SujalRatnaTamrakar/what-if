"""Gemini provider (§10.4) via the google-genai SDK.

google-genai is imported lazily so the module (and the fake provider) works
without the package installed.
"""
from __future__ import annotations

import os
from pathlib import Path

from backend.common.errors import (
    InvalidProviderOutput,
    ProviderTimeout,
    ProviderUnavailable,
)
from .base import LLMProvider, parse_json_text, prep_image_bytes


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(
        self,
        model: str | None = None,
        api_key: str | None = None,
        timeout: int = 60,
    ):
        self.model = model or os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self.timeout = timeout

    def generate_json(
        self,
        system: str,
        user: str,
        images: list[Path],
        schema: dict,
        timeout: int,
    ) -> dict:
        if not self.api_key:
            raise ProviderUnavailable("GEMINI_API_KEY is not set")
        try:
            from google import genai
            from google.genai import types
        except ImportError:
            raise ProviderUnavailable("google-genai package is not installed")

        try:
            image_parts = [
                types.Part.from_bytes(
                    data=prep_image_bytes(p), mime_type="image/jpeg"
                )
                for p in images
            ]
        except Exception as e:
            raise InvalidProviderOutput(f"Could not read input image: {e}")

        client = genai.Client(api_key=self.api_key)
        try:
            resp = client.models.generate_content(
                model=self.model,
                contents=[types.Part.from_text(text=user), *image_parts],
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    response_mime_type="application/json",
                    response_schema=schema,
                    temperature=0.2,
                ),
            )
        except Exception as e:
            msg = str(e)
            lowered = msg.lower()
            if "timeout" in lowered or "deadline" in lowered:
                raise ProviderTimeout(f"Gemini timed out: {msg[:200]}")
            raise ProviderUnavailable(f"Gemini API error: {msg[:300]}")

        text = getattr(resp, "text", None)
        if not text or not text.strip():
            raise InvalidProviderOutput("Gemini returned an empty response")
        data = parse_json_text(text, "Gemini")
        if not isinstance(data, dict):
            raise InvalidProviderOutput("Gemini returned JSON but not an object")
        return data
