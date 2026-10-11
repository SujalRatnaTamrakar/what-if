"""LLM providers selected per role by env var (PROMPT_PROVIDER, MODERATION_PROVIDER, REVIEW_PROVIDER).

Supported now: gemini, fake. Ollama is planned but not implemented yet.
"""
import logging
import os
import time
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from common.errors import InvalidProviderOutput, ProviderTimeout, ProviderUnavailable

log = logging.getLogger("agents")
T = TypeVar("T", bound=BaseModel)

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
_ROLE_ENV = {"prompt": "PROMPT_PROVIDER", "moderation": "MODERATION_PROVIDER", "review": "REVIEW_PROVIDER"}


def provider_name(role: str) -> str:
    return os.environ.get(_ROLE_ENV[role], "fake").strip() or "fake"


class GeminiProvider:
    name = "gemini"

    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        self.model = os.environ.get("GEMINI_MODEL", "").strip() or DEFAULT_GEMINI_MODEL
        self.timeout = int(os.environ.get("GEMINI_TIMEOUT_SECONDS", "60"))
        if not self.api_key:
            raise ProviderUnavailable("GEMINI_API_KEY is not set")

    def _client(self):
        from google import genai
        from google.genai import types
        return genai.Client(api_key=self.api_key,
                            http_options=types.HttpOptions(timeout=self.timeout * 1000))

    def _call(self, *, system: str, contents: list, schema: type[BaseModel] | None):
        from google.genai import errors, types
        config = types.GenerateContentConfig(system_instruction=system, temperature=0.2)
        if schema is not None:
            config.response_mime_type = "application/json"
            config.response_schema = schema
        start = time.monotonic()
        try:
            resp = self._client().models.generate_content(model=self.model, contents=contents, config=config)
        except errors.APIError as e:
            log.warning("gemini error code=%s: %s", e.code, e.message)
            if e.code in (408, 504):
                raise ProviderTimeout(f"Gemini timed out ({e.code})")
            raise ProviderUnavailable(f"Gemini error {e.code}: {e.message}")
        except Exception as e:  # network / httpx errors
            msg = str(e).lower()
            if "timeout" in msg or "timed out" in msg:
                raise ProviderTimeout(f"Gemini timed out: {e}")
            raise ProviderUnavailable(f"Gemini unreachable: {e}")
        finally:
            log.info("gemini call model=%s durationMs=%d", self.model, (time.monotonic() - start) * 1000)
        return resp.text or ""

    def generate_json(self, *, system: str, user: str, images: list, schema: type[T]) -> T:
        """Structured output with one repair retry, per the P2 plan."""
        prompt = user
        last_error: Exception | None = None
        for _ in range(2):
            text = self._call(system=system, contents=[prompt, *images], schema=schema)
            try:
                return schema.model_validate_json(text)
            except ValidationError as e:
                last_error = e
                prompt = (f"{user}\n\nYour previous output was invalid: {e.errors()[:3]}. "
                          f"Return ONLY valid JSON matching the schema.")
        raise InvalidProviderOutput(f"Gemini returned invalid JSON: {last_error}")

    def generate_text(self, *, system: str, user: str) -> str:
        return self._call(system=system, contents=[user], schema=None).strip()


def get_provider(role: str):
    """Returns a provider instance, or None for the fake provider (callers use deterministic output)."""
    name = provider_name(role)
    if name == "fake":
        return None
    if name == "gemini":
        return GeminiProvider()
    raise ProviderUnavailable(f"{_ROLE_ENV[role]}={name} is not supported yet (use gemini or fake)")
