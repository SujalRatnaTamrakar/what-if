from pathlib import Path

from PIL import Image

MAX_EDGE = 1024


def load_rgb(path: Path, max_edge: int = MAX_EDGE) -> Image.Image:
    img = Image.open(path).convert("RGB")
    img.thumbnail((max_edge, max_edge), Image.LANCZOS)
    return img


def load_mask(path: Path, size: tuple[int, int]) -> Image.Image:
    mask = Image.open(path).convert("L").resize(size, Image.NEAREST)
    return mask.point(lambda v: 255 if v >= 128 else 0)


def overlay_mask(image: Image.Image, mask: Image.Image, alpha: float = 0.4) -> Image.Image:
    """Source with the edit region tinted red, so a vision model can see where the change goes."""
    red = Image.new("RGB", image.size, (255, 0, 0))
    guide = image.copy()
    guide.paste(Image.blend(image, red, alpha), mask=mask)
    return guide
