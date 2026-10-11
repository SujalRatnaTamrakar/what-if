"""xAI Grok Imagine editing. Request shape follows docs.x.ai (POST /v1/images/edits, JSON, images[].url as data URI).
Like gemini_image, the API has no real mask input: a red-tinted guide image is sent as a second reference and the
shared composite in imaging.render_edit enforces mask locality."""
import base64
import io
import os

import requests
from PIL import Image

from .._errors import ProviderTimeout, ProviderUnavailable, RenderFailed
from ..types import ProviderOutput, prompt_field


def _data_uri(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.convert("RGB").save(buf, "JPEG", quality=92)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


class XAIImageProvider:
    def edit(self, source, mask, prompt, *, seed, timeout_s):
        key = os.environ.get("XAI_API_KEY")
        model = os.environ.get("XAI_IMAGE_MODEL")
        base = os.environ.get("XAI_BASE_URL", "https://api.x.ai/v1").rstrip("/")
        if not key or not model:
            raise ProviderUnavailable("XAI_API_KEY and XAI_IMAGE_MODEL must be set")

        guide = source.convert("RGB").copy()
        red = Image.new("RGB", guide.size, (255, 0, 0))
        guide.paste(Image.blend(guide, red, 0.45), mask=mask)

        goal = prompt_field(prompt, "editGoal") or prompt_field(prompt, "positive")
        text = (f"Edit <IMAGE_0>. <IMAGE_1> is the same photo with the edit region tinted red. {goal}. "
                f"Make the change only inside the red region, photorealistic, matching lighting and perspective. "
                f"Do not include any red tint. Keep everything else identical and keep the same framing.")
        body = {"model": model, "prompt": text,
                "images": [{"url": _data_uri(source)}, {"url": _data_uri(guide)}]}
        try:
            r = requests.post(f"{base}/images/edits", json=body, timeout=timeout_s,
                              headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        except requests.Timeout:
            raise ProviderTimeout("xAI image edit timed out")
        except requests.ConnectionError as e:
            raise ProviderUnavailable(f"xAI unreachable: {e}")

        if r.status_code in (401, 402, 403, 429) or r.status_code >= 500:
            raise ProviderUnavailable(f"xAI image API {r.status_code}: {r.text[:200]}")
        if not r.ok:
            raise RenderFailed(f"xAI image API {r.status_code}: {r.text[:300]}")

        try:
            item = r.json()["data"][0]
        except (KeyError, IndexError, ValueError):
            raise RenderFailed("no image returned")
        try:
            if item.get("b64_json"):
                raw = base64.b64decode(item["b64_json"])
            elif item.get("url"):
                raw = requests.get(item["url"], timeout=60).content
            else:
                raise RenderFailed("no image returned")
            img = Image.open(io.BytesIO(raw)).convert("RGB").resize(source.size, Image.LANCZOS)
        except RenderFailed:
            raise
        except Exception as e:
            raise RenderFailed(f"could not read xAI image: {e}")
        return ProviderOutput(img, "xai_image", model, None, "xai_composite_v1")
