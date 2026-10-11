from PIL import Image, ImageDraw
from ..types import ProviderOutput


class FakeProvider:
    """Development only. The app must show a 'Demo renderer (fake)' banner when RENDER_PROVIDER=fake."""

    def edit(self, source, mask, prompt, *, seed, timeout_s):
        img = source.convert("RGB").copy()
        teal = Image.new("RGB", img.size, (20, 160, 150))
        img.paste(Image.blend(img, teal, 0.45), mask=mask)            # 45% teal inside the mask
        bbox = mask.getbbox()
        if bbox:
            cx, cy = (bbox[0] + bbox[2]) // 2, (bbox[1] + bbox[3]) // 2
            ImageDraw.Draw(img).text((cx - 30, cy), "FAKE RENDER", fill=(255, 255, 255))
        return ProviderOutput(img, "fake", "none", seed, "fake_v1")
