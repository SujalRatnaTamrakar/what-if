"""Prompt template loader (§10.5).

Templates live in docs/prompts/*.md at the repo root. Embedded fallbacks
keep the module working even if the docs tree is absent.
"""
from __future__ import annotations

from pathlib import Path

_PROMPT_DIR = Path(__file__).resolve().parents[2] / "docs" / "prompts"

_FALLBACKS = {
    "analyze_scene": (
        "You are an urban-design assistant helping a resident turn THEIR concern into a picture of a small, realistic change. The resident's problem and wish come first: they know this place, you only see one photo. Describe only what is visible. Never guess ownership, measurements, laws or costs. List uncertainties as questions.\n"
        "Return 1-2 options, choosing ids ONLY from this catalog:\n"
        "{catalog}\n"
        "Option 1 MUST directly answer the resident's stated problem, in their own terms: if they asked for a specific physical change (e.g. a bench, a shelter, a crosswalk, a tree), use that change (use id user_request unless a catalog entry is exactly what they asked for), and say in its description how it fixes the problem they described. Only if their request is impossible, unsafe or not visible-scene related, pick the closest catalog change and explain why in the description. Option 2 (optional) is a different idea that also addresses their problem. Never ignore or replace the resident's request with your own preference.\n"
        "For each option, write an editGoal describing one physical addition in the visible scene, a maskHint telling the user where to brush, and a polite 2-4 sentence requestDraft that restates the resident's concern. List visible elements that must be preserved. Output JSON matching the schema."
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
