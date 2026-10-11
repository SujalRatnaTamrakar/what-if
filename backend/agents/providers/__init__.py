"""Provider selection (§10.4). ``get_provider(role)`` reads SCENE_PROVIDER /
DRAFT_PROVIDER / REVIEW_PROVIDER. Defaults to fake so everything runs with
no API keys.

Values: fake | ollama | gemini | openai | fallback.
When ``fallback``, the chain is resolved from SCENE_CHAIN / DRAFT_CHAIN /
REVIEW_CHAIN (comma-separated, e.g. ``gemini,openai,ollama``) and each leg is
tried in order on transient errors only (see chain.py).
"""
from __future__ import annotations

import os

from .chain import _DEFAULT_CHAINS, _ROLE_CHAIN_ENV, FallbackProvider
from .fake import FakeProvider
from .gemini import GeminiProvider
from .ollama import OllamaProvider
from .openai import OpenAIProvider

_ROLE_ENV = {
    "scene": "SCENE_PROVIDER",
    "draft": "DRAFT_PROVIDER",
    "review": "REVIEW_PROVIDER",
}


def _build_single(name: str, role: str):
    """Build one concrete (non-chain) provider."""
    if name == "fake":
        return FakeProvider(kind=role)

    if name == "ollama":
        if role == "scene":
            model = os.environ.get("OLLAMA_VISION_MODEL", "qwen2.5vl:7b")
        else:
            model = os.environ.get("OLLAMA_TEXT_MODEL", "llama3.1:8b")
        timeout = int(os.environ.get("OLLAMA_TIMEOUT_SECONDS", "90"))
        return OllamaProvider(model=model, timeout=timeout)

    if name == "gemini":
        model = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
        timeout = int(os.environ.get("GEMINI_TIMEOUT_SECONDS", "60"))
        return GeminiProvider(model=model, timeout=timeout)

    if name == "openai":
        model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
        timeout = int(os.environ.get("OPENAI_TIMEOUT_SECONDS", "60"))
        return OpenAIProvider(model=model, timeout=timeout)

    raise ValueError(
        f"Unknown provider {name!r} for role {role!r} "
        f"(env {_ROLE_ENV[role]}). Expected fake|ollama|gemini|openai|fallback."
    )


def get_provider(role: str):
    """Return an LLMProvider for ``role`` (scene | draft | review)."""
    if role not in _ROLE_ENV:
        raise ValueError(f"Unknown provider role: {role!r}")
    name = os.environ.get(_ROLE_ENV[role], "fake").strip().lower()

    if name == "fallback":
        chain_env = _ROLE_CHAIN_ENV[role]
        raw = os.environ.get(chain_env, _DEFAULT_CHAINS[role])
        legs = [
            _build_single(leg.strip().lower(), role)
            for leg in raw.split(",")
            if leg.strip()
        ]
        if not legs:
            raise ValueError(f"{chain_env} is empty; need at least one provider")
        return FallbackProvider(role=role, legs=legs)

    return _build_single(name, role)
