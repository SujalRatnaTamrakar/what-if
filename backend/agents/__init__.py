"""PlacePatch AI agents module (P2) — §10 of the master plan.

Public interface (frozen — see §10.2):
    analyze_scene(image_path, problem_text, place_label, category="shade") -> Scene
    build_edit_prompt(scene, option, problem_text) -> EditPrompt
    review_concept(source_path, concept_path, mask_path, option, change_request) -> Review
    draft_request(scene, option, review, place_label, problem_text) -> RequestDraft

Pure Python. No Django imports — configuration comes from ``os.environ`` only.
Providers default to ``fake`` so the full loop runs with no API keys.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from pydantic import ValidationError

from backend.agents import prompts
from backend.agents.catalog import CATALOG
from backend.agents.providers import get_provider
from backend.agents.schemas import (
    EditPrompt,
    Flag,
    Option,
    RequestDraft,
    Review,
    Scene,
    utc_now_z,
)
from backend.common.errors import InvalidProviderOutput

__all__ = [
    "analyze_scene",
    "build_edit_prompt",
    "review_concept",
    "draft_request",
    "Scene",
    "Option",
    "EditPrompt",
    "Review",
    "RequestDraft",
]

_FLAG_CODES = [
    "UNMASKED_CHANGE",
    "REQUEST_MISMATCH",
    "IMPLAUSIBLE_STRUCTURE",
    "PEOPLE_VISIBLE",
    "PLATE_VISIBLE",
    "PRIVATE_INFO_VISIBLE",
    "SAFETY_OR_COMPLIANCE_CLAIM",
    "LOW_QUALITY_EDIT",
    "REVIEW_UNAVAILABLE",
]


def _schema_for(model_cls) -> dict:
    """JSON schema for a Pydantic model, with $defs inlined for providers."""
    schema = model_cls.model_json_schema()
    defs = schema.pop("$defs", {})

    def inline(node):
        if isinstance(node, dict):
            if set(node.keys()) == {"$ref"}:
                name = node["$ref"].split("/")[-1]
                return inline(dict(defs[name]))
            return {k: inline(v) for k, v in node.items()}
        if isinstance(node, list):
            return [inline(v) for v in node]
        return node

    return inline(schema)


def _generate_validated(provider, role: str, system: str, user: str,
                        images: list[Path], model_cls, timeout: int):
    """Call the provider and validate against ``model_cls``.

    One repair retry: on validation failure the error is appended to the
    prompt and the provider is asked once more. Then InvalidProviderOutput.
    Transport errors (ProviderUnavailable/ProviderTimeout) propagate.
    """
    schema = _schema_for(model_cls)
    attempt_user = user
    last_err = "no attempt made"
    for attempt in (1, 2):
        data = provider.generate_json(
            system=system, user=attempt_user, images=images,
            schema=schema, timeout=timeout,
        )
        if not isinstance(data, dict):
            last_err = f"provider returned {type(data).__name__}, expected a JSON object"
        else:
            try:
                return model_cls.model_validate(data)
            except ValidationError as e:
                last_err = e.json()
        if attempt == 1:
            attempt_user = (
                user
                + "\n\nYour previous output failed validation with these errors:\n"
                + str(last_err)
                + "\nReturn corrected JSON only, no prose."
            )
    raise InvalidProviderOutput(
        f"{provider.name} output failed validation twice: {last_err}"
    )


def _timeout_for(provider) -> int:
    return int(getattr(provider, "timeout", 60) or 60)


def _require_image(path: Path | str, what: str) -> Path:
    p = Path(path)
    if not p.exists():
        raise InvalidProviderOutput(f"{what} image not found: {p}")
    return p


def analyze_scene(image_path: Path, problem_text: str, place_label: str,
                  category: str = "shade") -> Scene:
    """Describe the scene and suggest 1–2 catalog interventions."""
    image = _require_image(image_path, "source")
    if category not in CATALOG:
        raise InvalidProviderOutput(f"Unknown category {category!r}")

    provider = get_provider("scene")
    catalog_text = "\n".join(
        f"- {e['id']}: {e['title']} — {e['base_goal']}"
        for e in CATALOG[category]
    )
    system = prompts.load_prompt("analyze_scene").format(catalog=catalog_text)
    user = (
        f"Place: {place_label}\n"
        f"Problem: {problem_text}\n"
        f"Category: {category}\n\n"
        "Describe only what is visible in the attached photo. "
        "Choose 1-2 interventions ONLY from the catalog above. Return JSON only."
    )
    scene = _generate_validated(
        provider, "scene", system, user, [image], Scene, _timeout_for(provider)
    )
    valid_ids = {e["id"] for e in CATALOG[category]}
    for opt in scene.options:
        if opt.id not in valid_ids:
            raise InvalidProviderOutput(
                f"Model invented option id {opt.id!r} outside the catalog"
            )
        opt.category = category
    # Stamp real provenance (never trust the model's metadata fields).
    scene.provider = provider.name
    scene.model = provider.model
    scene.analyzed_at = utc_now_z()
    return scene


def build_edit_prompt(scene: Scene, option: Option, problem_text: str) -> EditPrompt:
    """Deterministic template (§10.5). No LLM call."""
    base_goal = next(
        (e["base_goal"] for e in CATALOG.get(option.category, [])
         if e["id"] == option.id),
        option.title,
    )
    positive = (
        f"photorealistic {base_goal}, {option.edit_goal}, "
        "matching existing lighting, perspective and materials, daytime street photo"
    )
    negative = "text, watermark, people, cars, distortion, extra signs, cartoon, blurry"
    return EditPrompt(
        positive=positive,
        negative=negative,
        preserve=list(scene.preserve),
        edit_goal=option.edit_goal,
    )


def review_concept(source_path: Path, concept_path: Path, mask_path: Path,
                   option: Option, change_request: str) -> Review:
    """LLM review + deterministic outside-mask check (§10.5)."""
    source = _require_image(source_path, "source")
    concept = _require_image(concept_path, "concept")
    mask = _require_image(mask_path, "mask")

    provider = get_provider("review")
    system = prompts.load_prompt("review_concept").format(
        flag_codes=", ".join(_FLAG_CODES)
    )
    user = (
        "BEFORE, AFTER and MASK images are attached in that order.\n"
        f"Requested change: {option.edit_goal}\n"
        f"Change request text: {change_request}\n\n"
        "Report only problems you can see, as JSON flags. Return JSON only."
    )
    review = _generate_validated(
        provider, "review", system, user,
        [source, concept, mask], Review, _timeout_for(provider),
    )

    # Deterministic check: imaging.outside_mask_change (§11.2). Lazy import so
    # this module works before P3's imaging package exists.
    change = None
    try:
        from backend.imaging import outside_mask_change

        change = outside_mask_change(source, concept, mask)
    except Exception as e:  # imaging not installed yet — skip, don't fail
        print(
            f"[agents] deterministic mask check skipped "
            f"(backend.imaging unavailable: {e})",
            file=sys.stderr,
        )
    if change is not None:
        review.outside_mask_change = change
        codes = {f.code for f in review.flags}
        if change > 0.10 and "UNMASKED_CHANGE" not in codes:
            review.flags.append(Flag(
                id="", code="UNMASKED_CHANGE", severity="blocking",
                message=f"Measured change outside the mask is {change:.3f} (> 0.10).",
            ))
        elif change > 0.03 and "UNMASKED_CHANGE" not in codes:
            review.flags.append(Flag(
                id="", code="UNMASKED_CHANGE", severity="warning",
                message=f"Measured change outside the mask is {change:.3f} (> 0.03).",
            ))

    for i, flag in enumerate(review.flags, 1):
        flag.id = f"f{i}"
    severities = {f.severity for f in review.flags}
    if "blocking" in severities:
        review.verdict = "blocked"
    elif "warning" in severities:
        review.verdict = "needs_review"
    else:
        review.verdict = "clear"

    review.provider = provider.name
    review.model = provider.model
    review.reviewed_at = utc_now_z()
    return review


def draft_request(scene: Scene, option: Option, review: Review,
                  place_label: str, problem_text: str) -> RequestDraft:
    """Draft the community request text (title ≤120, body ≤1500)."""
    provider = get_provider("draft")
    system = prompts.load_prompt("draft_request").format(option=option.title)
    user = (
        f"Place: {place_label}\n"
        f"Problem: {problem_text}\n"
        f"Chosen intervention: {option.title} — {option.description}\n\n"
        "Write the title and body as JSON. Return JSON only."
    )
    return _generate_validated(
        provider, "draft", system, user, [], RequestDraft, _timeout_for(provider)
    )
