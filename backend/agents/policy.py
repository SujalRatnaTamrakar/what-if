"""Fast synchronous keyword filter. A first line of defence only; AI moderation does the rest."""
import re

from .schemas import ModerationResult

_BLOCKLIST: dict[str, tuple[str, ...]] = {
    "violence": ("gun", "guns", "rifle", "bomb", "explosion", "blood", "corpse", "kill", "murder",
                 "shooting", "stab", "weapon", "weapons"),
    "sexual": ("nude", "naked", "porn", "sex", "sexy", "nsfw"),
    "hate": ("nazi", "swastika", "kkk"),
    "targets_person": ("my neighbor's face", "his face", "her face"),
}
# Phrases that contain blocked words but are harmless place requests.
_ALLOWLIST = ("shoot a photo", "photo shoot", "remove graffiti", "kill weeds")

_DISALLOWED_REASON = "That request can't be generated. Try describing a place improvement."


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def keyword_check(text: str) -> ModerationResult:
    norm = _normalize(text)
    for phrase in _ALLOWLIST:
        norm = norm.replace(phrase, " ")
    words = set(re.findall(r"[a-z']+", norm))
    hits = []
    for category, terms in _BLOCKLIST.items():
        for term in terms:
            if (" " in term and term in norm) or term in words:
                hits.append(category)
                break
    if hits:
        return ModerationResult(allowed=False, reason=_DISALLOWED_REASON, categories=hits)
    return ModerationResult(allowed=True)
