"""Ollama provider (§10.4).

POST {OLLAMA_BASE_URL}/api/chat with model, messages (images base64 on the
user message), format=<JSON schema>, stream=false, temperature 0.2.
"""
from __future__ import annotations

import base64
import os
from pathlib import Path

import httpx

from backend.common.errors import (
    InvalidProviderOutput,
    ProviderTimeout,
    ProviderUnavailable,
)
from .base import LLMProvider, parse_json_text, prep_image_bytes


class OllamaProvider(LLMProvider):
    name = "ollama"

    def __init__(
        self,
        model: str,
        base_url: str | None = None,
        timeout: int = 90,
    ):
        self.model = model
        self.base_url = (base_url or os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")).rstrip("/")
        self.timeout = timeout

    def generate_json(
        self,
        system: str,
        user: str,
        images: list[Path],
        schema: dict,
        timeout: int,
    ) -> dict:
        try:
            payload_images = [
                base64.b64encode(prep_image_bytes(p)).decode("ascii") for p in images
            ]
        except Exception as e:
            raise InvalidProviderOutput(f"Could not read input image: {e}")

        body = {
            "model": self.model,
            "stream": False,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user, "images": payload_images},
            ],
            "format": schema,
            "options": {"temperature": 0.2},
        }
        try:
            r = httpx.post(
                f"{self.base_url}/api/chat", json=body, timeout=timeout or self.timeout
            )
        except httpx.ConnectError as e:
            raise ProviderUnavailable(f"Ollama unreachable at {self.base_url}: {e}")
        except httpx.TimeoutException:
            raise ProviderTimeout(f"Ollama timed out after {timeout or self.timeout}s")
        except httpx.HTTPError as e:
            raise ProviderUnavailable(f"Ollama transport error: {e}")

        if r.status_code == 404:
            raise ProviderUnavailable(
                f"Ollama model '{self.model}' not found (404). Pull it or fix OLLAMA_*_MODEL."
            )
        if r.status_code >= 400:
            raise ProviderUnavailable(f"Ollama HTTP {r.status_code}: {r.text[:200]}")

        try:
            content = r.json()["message"]["content"]
        except Exception as e:
            raise InvalidProviderOutput(f"Ollama returned an unexpected envelope: {e}")
        data = parse_json_text(content, "Ollama")
        if not isinstance(data, dict):
            raise InvalidProviderOutput("Ollama returned JSON but not an object")
        return data

    def list_models(self) -> list[str]:
        """Return installed model names (used by `cli check`)."""
        try:
            r = httpx.get(f"{self.base_url}/api/tags", timeout=10)
            r.raise_for_status()
            return [m.get("name", "?") for m in r.json().get("models", [])]
        except httpx.HTTPError as e:
            raise ProviderUnavailable(f"Ollama unreachable at {self.base_url}: {e}")
