import os
from .._errors import RenderFailed


def get_renderer(name: "str | None" = None):
    """Reads RENDER_PROVIDER (comfyui | gemini_image | xai_image | fake). Heavy imports are lazy."""
    name = name or os.environ.get("RENDER_PROVIDER", "fake")
    if name == "comfyui":
        from .comfyui import ComfyUIProvider
        return ComfyUIProvider()
    if name == "gemini_image":
        from .gemini_image import GeminiImageProvider
        return GeminiImageProvider()
    if name == "xai_image":
        from .xai_image import XAIImageProvider
        return XAIImageProvider()
    if name == "fake":
        from .fake import FakeProvider
        return FakeProvider()
    raise RenderFailed(f"unknown RENDER_PROVIDER '{name}'")
