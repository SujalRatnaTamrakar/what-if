from dataclasses import dataclass
from pathlib import Path


@dataclass
class RenderResult:
    output_path: Path          # PNG, same width/height as source, in a temp dir (P4 moves it)
    provider: str              # "comfyui" | "gemini_image" | "fake"
    model: str
    seed: "int | None"
    duration_ms: int
    workflow_version: str      # "inpaint_v1" | "gemini_composite_v1" | "fake_v1"
    width: int
    height: int


@dataclass
class ProviderOutput:
    """Internal: what a provider returns (image at WORK size + honest metadata)."""
    image: object              # PIL.Image.Image, RGB
    provider: str
    model: str
    seed: "int | None"
    workflow_version: str


def prompt_field(prompt, name, default=""):
    """EditPrompt may be a dict, a pydantic model (camelCase alias or snake_case attribute) or a stub."""
    if isinstance(prompt, dict):
        return prompt.get(name, default)
    snake = "".join("_" + c.lower() if c.isupper() else c for c in name)
    return getattr(prompt, name, None) or getattr(prompt, snake, None) or default
