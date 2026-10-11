"""OpenAI provider (§10.4) via the ``openai`` package.

Implements the same LLMProvider interface as gemini/ollama: structured JSON
via chat completions with ``response_format={"type": "json_object"}``.
Images are attached as base64 data-URL content parts.

Env:
  OPENAI_API_KEY  (required)
  OPENAI_MODEL    default gpt-4o-mini
  OPENAI_TIMEOUT_SECONDS default 60

Error mapping (drives the fallback chain):
  429 / 5xx / timeout / connection  -> ProviderUnavailable / ProviderTimeout
                                      (transient -> chain moves on)
  400 (bad request / validation)     -> InvalidProviderOutput (surfaces, no fallback)
  401 / 403 (auth)                   -> ProviderUnavailable (chain may try next leg)
"""
from __future__ import annotations

import base64
import os
from pathlib import Path

from backend.common.errors import (
    InvalidProviderOutput,
    ProviderTimeout,
    ProviderUnavailable,
)
from .base import LLMProvider, parse_json_text, prep_image_bytes


class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(
        self,
        model: str | None = None,
        api_key: str | None = None,
        timeout: int = 60,
    ):
        self.model = model or os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        self.timeout = timeout or int(os.environ.get("OPENAI_TIMEOUT_SECONDS", "60"))

    def _client(self):
        if not self.api_key:
            raise ProviderUnavailable("OPENAI_API_KEY is not set")
        try:
            from openai import OpenAI
        except ImportError:
            raise ProviderUnavailable("openai package is not installed")
        # The sandbox proxy breaks on the bracketed NO_PROXY entries; the
        # openai SDK reads proxy env itself, so drop the broken entries here.
        import httpx as _httpx

        for var in ("NO_PROXY", "no_proxy"):
            val = os.environ.get(var, "")
            if "[" in val:
                os.environ.pop(var, None)
        return OpenAI(api_key=self.api_key, timeout=self.timeout)

    def generate_json(
        self,
        system: str,
        user: str,
        images: list[Path],
        schema: dict,
        timeout: int,
    ) -> dict:
        try:
            image_b64 = [base64.b64encode(prep_image_bytes(p)).decode("ascii") for p in images]
        except Exception as e:
            raise InvalidProviderOutput(f"Could not read input image: {e}")

        content: list[dict] = [{"type": "text", "text": user}]
        for b64 in image_b64:
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                }
            )

        client = self._client()
        try:
            resp = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": content},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
                timeout=timeout or self.timeout,
            )
        except Exception as e:
            raise _map_error(e)

        text = None
        try:
            text = resp.choices[0].message.content
        except Exception:
            pass
        if not text or not text.strip():
            raise InvalidProviderOutput("OpenAI returned an empty response")
        data = parse_json_text(text, "OpenAI")
        if not isinstance(data, dict):
            raise InvalidProviderOutput("OpenAI returned JSON but not an object")
        return data


def _map_error(e: Exception):
    """Map openai SDK exceptions onto the provider error taxonomy."""
    from openai import (
        APIConnectionError,
        APIStatusError,
        APITimeoutError,
        AuthenticationError,
        BadRequestError,
        RateLimitError,
    )

    if isinstance(e, BadRequestError):
        # 400: bad prompt / schema / image — a contract problem, never retried.
        return InvalidProviderOutput(f"OpenAI rejected the request (400): {str(e)[:300]}")
    if isinstance(e, RateLimitError):
        return ProviderUnavailable(f"OpenAI rate limited (429): {str(e)[:200]}")
    if isinstance(e, APITimeoutError):
        return ProviderTimeout(f"OpenAI timed out: {str(e)[:200]}")
    if isinstance(e, AuthenticationError):
        return ProviderUnavailable(f"OpenAI auth failed (401/403) — check OPENAI_API_KEY")
    if isinstance(e, APIConnectionError):
        return ProviderUnavailable(f"cannot reach OpenAI API: {str(e)[:200]}")
    if isinstance(e, APIStatusError):
        status = getattr(e, "status_code", None)
        if status == 404:
            # retired/unknown model id — transient for the fallback chain
            return ProviderUnavailable(f"OpenAI model not found (404): {str(e)[:200]}")
        if status and status >= 500:
            return ProviderUnavailable(f"OpenAI server error ({status}): {str(e)[:200]}")
        return ProviderUnavailable(f"OpenAI API error ({status}): {str(e)[:300]}")
    msg = str(e).lower()
    if "timeout" in msg or "deadline" in msg:
        return ProviderTimeout(f"OpenAI timed out: {str(e)[:200]}")
    return ProviderUnavailable(f"OpenAI API error: {str(e)[:300]}")
