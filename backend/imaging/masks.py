from pathlib import Path
from PIL import Image, ImageFilter
from ._errors import RenderFailed


def load_mask(mask_path: Path, size: tuple) -> Image.Image:
    """Mask contract: mode L, 255 = edit. Must equal the source size. Binarized at 128."""
    m = Image.open(mask_path).convert("L")
    if m.size != size:
        raise RenderFailed("mask size mismatch")
    return m.point(lambda v: 255 if v >= 128 else 0)


def dilate(mask: Image.Image, px: int) -> Image.Image:
    for _ in range(max(px, 0)):
        mask = mask.filter(ImageFilter.MaxFilter(3))
    return mask


def prepare(mask_work: Image.Image, dilate_px: int = 8, feather_px: int = 12):
    """Return (hard, soft). hard -> sent to the model; soft (dilated + feathered) -> used to composite."""
    hard = dilate(mask_work, dilate_px)
    soft = hard.filter(ImageFilter.GaussianBlur(radius=feather_px)) if feather_px > 0 else hard
    return hard, soft


def overlay_debug(source: Image.Image, mask: Image.Image) -> Image.Image:
    """Source with the mask tinted red + outlined, to check alignment by eye."""
    s = source.convert("RGB")
    red = Image.new("RGB", s.size, (255, 0, 0))
    out = s.copy()
    out.paste(Image.blend(s, red, 0.5), mask=mask)
    edge = mask.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.MaxFilter(3))
    out.paste(Image.new("RGB", s.size, (255, 255, 0)), mask=edge)
    return out
