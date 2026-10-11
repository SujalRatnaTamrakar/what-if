"""Prompt template loader (§10.5).

Templates live in docs/prompts/*.md at the repo root. Embedded fallbacks
keep the module working even if the docs tree is absent.
"""
from __future__ import annotations

from pathlib import Path

_PROMPT_DIR = Path(__file__).resolve().parents[2] / "docs" / "prompts"

_FALLBACKS = {
    "analyze_scene": (
        "You are an urban-design assistant. Describe only what is visible. "
        "Never guess ownership, measurements, laws or costs. List uncertainties "
        "as questions. Choose 1-2 interventions ONLY from this catalog:\n"
        "{catalog}\n"
        "For each, write an editGoal describing one physical addition in the "
        "visible scene, a maskHint telling the user where to brush, and a polite "
        "2-4 sentence requestDraft. List visible elements that must be preserved. "
        "Output JSON matching the schema."
    ),
    "review_concept": (
        "Compare BEFORE, AFTER and MASK images. Report only problems you can see: "
        "changes outside the white mask area, a result that does not match the "
        "request, implausible or floating structures, visible people, license plates "
        "or private info, low quality. Never state the design is safe, compliant or "
        "approved. Output flags using only these codes: {flag_codes}. Severity: "
        "blocking for people/plates/private info newly introduced or a result "
        "unrelated to the request; warning for plausibility or quality; info otherwise."
    ),
    "draft_request": (
        "Write a respectful, specific community request (title \u2264 80 chars, body 3-6 "
        "sentences) asking the responsible organization to consider {option}. "
        "Mention the place and problem. Include 'This image is an AI illustration, "
        "not a design.' Do not claim cost, approval, compliance or that anyone has agreed."
    ),
}


def load_prompt(name: str) -> str:
    """Return the raw template text for ``name`` (without .md suffix)."""
    path = _PROMPT_DIR / f"{name}.md"
    if path.exists():
        return path.read_text(encoding="utf-8")
    if name in _FALLBACKS:
        return _FALLBACKS[name]
    raise KeyError(f"Unknown prompt template: {name}")
