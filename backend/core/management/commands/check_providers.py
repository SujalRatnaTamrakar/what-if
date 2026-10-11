"""Ping configured providers per §6.1; prints a table (G0 readiness check)."""
from __future__ import annotations

import socket
from urllib.parse import urlparse

from django.conf import settings
from django.core.management.base import BaseCommand


def _tcp_ok(base_url: str, timeout: float = 3.0) -> tuple[bool, str]:
    try:
        parts = urlparse(base_url)
        host, port = parts.hostname, parts.port or (443 if parts.scheme == "https" else 80)
        with socket.create_connection((host, port), timeout=timeout):
            return True, "reachable"
    except Exception as exc:
        return False, str(exc)


def _http_ok(url: str, timeout: float = 5.0) -> tuple[bool, str]:
    import requests

    try:
        r = requests.get(url, timeout=timeout)
        return (r.status_code < 500, f"HTTP {r.status_code}")
    except Exception as exc:
        return False, str(exc)


class Command(BaseCommand):
    help = "Check provider reachability (Ollama / Gemini / ComfyUI)."

    def handle(self, *args, **options):
        rows = []
        text_roles = (settings.SCENE_PROVIDER, settings.DRAFT_PROVIDER, settings.REVIEW_PROVIDER)
        chains = " ".join(
            [settings.SCENE_CHAIN, settings.DRAFT_CHAIN, settings.REVIEW_CHAIN,
             settings.RENDER_CHAIN]
        )
        wants = lambda *names: any(p in text_roles for p in names) or any(
            n in chains for n in names
        )
        if wants("ollama"):
            ok, msg = _http_ok(f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/tags")
            rows.append(("ollama", settings.OLLAMA_BASE_URL, ok, msg))
        if wants("gemini"):
            ok = bool(settings.GEMINI_API_KEY)
            rows.append(("gemini", settings.GEMINI_MODEL or "(model id)", ok,
                         "API key set" if ok else "GEMINI_API_KEY missing"))
        if wants("openai"):
            ok = bool(settings.OPENAI_API_KEY)
            rows.append(("openai", settings.OPENAI_MODEL or "(model id)", ok,
                         "API key set" if ok else "OPENAI_API_KEY missing"))
        if settings.RENDER_PROVIDER == "comfyui" or "comfyui" in settings.RENDER_CHAIN:
            ok, msg = _http_ok(f"{settings.COMFYUI_BASE_URL.rstrip('/')}/system_stats")
            rows.append(("comfyui", settings.COMFYUI_BASE_URL, ok, msg))
        if settings.RENDER_PROVIDER == "fallback":
            rows.append(("fallback", settings.RENDER_CHAIN, True, "chain (see legs above)"))
        rows.append(("fake", "inline", True, "always available"))

        self.stdout.write(f"{'provider':<10}{'target':<45}{'ok':<6}detail")
        for name, target, ok, msg in rows:
            self.stdout.write(f"{name:<10}{str(target):<45}{str(ok):<6}{msg}")
