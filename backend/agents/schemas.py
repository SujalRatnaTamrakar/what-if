"""Pydantic v2 schemas for the PlacePatch agents module (P2).

``model_dump(by_alias=True)`` produces EXACTLY the camelCase JSON in §5.3
of the master plan. P4 stores ``model_dump(by_alias=True, mode="json")``.
"""
from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field


def to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p[:1].upper() + p[1:] for p in parts[1:])


def utc_now_z() -> str:
    """Current UTC time as ISO-8601 with Z, per §5.1."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class AgentModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Uncertainty(AgentModel):
    id: str
    question: str


class Option(AgentModel):
    """One suggested change. ``id`` must come from the catalog (§10.3)."""

    id: str
    category: str
    title: str
    description: str
    edit_goal: str
    mask_hint: str
    request_draft: str


class Scene(AgentModel):
    summary: str
    observations: list[str]
    uncertainties: list[Uncertainty]
    preserve: list[str]
    options: list[Option] = Field(min_length=1, max_length=2)
    provider: str
    model: str
    analyzed_at: str


class Flag(AgentModel):
    id: str
    code: str  # one of §5.2 FlagCode
    severity: str  # one of §5.2 FlagSeverity
    message: str


class Review(AgentModel):
    verdict: str  # one of §5.2 ReviewVerdict
    flags: list[Flag]
    outside_mask_change: float = Field(ge=0.0, le=1.0)
    provider: str
    model: str
    reviewed_at: str


class EditPrompt(AgentModel):
    """Internal (P2 → P3). Not exposed to clients."""

    positive: str
    negative: str
    preserve: list[str]
    edit_goal: str


class RequestDraft(AgentModel):
    title: str = Field(max_length=120)
    change_request: str = Field(max_length=1500)
