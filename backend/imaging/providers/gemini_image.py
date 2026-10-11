import io
import os

from PIL import Image

from .._errors import ProviderTimeout, ProviderUnavailable, RenderFailed
from ..types import ProviderOutput, prompt_field


class GeminiImageProvider:
    """No real mask input: we send a red-highlighted guide, then core.composite() enforces locality."""

    def edit(self, source, mask, prompt, *, seed, timeout_s):
        key = os.environ.get("GEMINI_API_KEY")
        model = os.environ.get("GEMINI_IMAGE_MODEL")
        if not key or not model:
            raise ProviderUnavailable("GEMINI_API_KEY and GEMINI_IMAGE_MODEL must be set")
        try:
            from google import genai
            from google.genai import types
        except ImportError:
            raise ProviderUnavailable("google-genai is not installed")

        guide = source.convert("RGB").copy()
        red = Image.new("RGB", guide.size, (255, 0, 0))
        guide.paste(Image.blend(guide, red, 0.45), mask=mask)

        goal = prompt_field(prompt, "editGoal") or prompt_field(prompt, "positive")
        text = (f"Image 1 is the original photo. Image 2 is the same photo with the edit region tinted red. "
                f"Edit image 1: {goal}. Make the change only inside the red region, photorealistic, matching lighting "
                f"and perspective. Do not include any red tint. Keep everything else identical and keep the same framing. "
                f"Return the full edited image.")
        try:
            client = genai.Client(api_key=key, http_options=types.HttpOptions(timeout=int(timeout_s * 1000)))
            resp = client.models.generate_content(model=model, contents=[text, source.convert("RGB"), guide])
        except Exception as e:  # map SDK errors to contract codes
            msg = str(e).lower()
            if "timeout" in msg or "deadline" in msg:
                raise ProviderTimeout(f"Gemini image timed out: {e}")
            if any(t in msg for t in ("429", "503", "500", "unavailable", "quota", "connect")):
                raise ProviderUnavailable(f"Gemini image unavailable: {e}")
            raise RenderFailed(f"Gemini image error: {e}")

        for cand in (resp.candidates or []):
            for part in (cand.content.parts or []):
                if getattr(part, "inline_data", None) and part.inline_data.data:
                    img = Image.open(io.BytesIO(part.inline_data.data)).convert("RGB").resize(source.size, Image.LANCZOS)
                    return ProviderOutput(img, "gemini_image", model, None, "gemini_composite_v1")
        raise RenderFailed("Gemini returned no image")
