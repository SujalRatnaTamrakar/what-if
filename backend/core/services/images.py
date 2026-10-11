"""Image upload sanitizing — §5.8 of the master plan.

EXIF orientation applied, metadata stripped, RGB, longest edge <= MAX_IMAGE_EDGE,
re-encoded as JPEG q90. The raw upload is never stored. Feed thumbnails
(longest edge 512) are generated for ProposalSummary (review-notes fix #1).
"""
from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings
from PIL import Image, ImageOps

from core.exceptions import ApiError

try:  # HEIC support for iPhone photos
    from pillow_heif import register_heif_opener

    register_heif_opener()
except Exception:  # pragma: no cover
    pass

_ALLOWED_MIME = {"image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"}
_THUMB_EDGE = 512


@dataclass
class SanitizedImage:
    path: Path          # full path of the sanitized JPEG (inside MEDIA_ROOT)
    rel_path: str       # path relative to MEDIA_ROOT (stored on Asset)
    thumb_rel_path: str
    width: int
    height: int
    sha256: str


def _sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _save_thumb(img: Image.Image, rel_name: str) -> str:
    thumb = img.copy()
    thumb.thumbnail((_THUMB_EDGE, _THUMB_EDGE), Image.LANCZOS)
    thumb_dir = Path(settings.MEDIA_ROOT) / "thumbs"
    thumb_dir.mkdir(parents=True, exist_ok=True)
    thumb_path = thumb_dir / rel_name
    thumb.save(thumb_path, format="JPEG", quality=82)
    return f"thumbs/{rel_name}"


def sanitize_upload(uploaded_file) -> SanitizedImage:
    """Validate + sanitize an uploaded photo. Raises ApiError on problems."""
    size = getattr(uploaded_file, "size", None)
    if size is not None and size > settings.MAX_UPLOAD_BYTES:
        raise ApiError("IMAGE_TOO_LARGE")
    content_type = (getattr(uploaded_file, "content_type", "") or "").split(";")[0].strip().lower()
    if content_type and content_type not in _ALLOWED_MIME:
        raise ApiError("UNSUPPORTED_IMAGE")

    try:
        img = Image.open(uploaded_file)
        img.load()
    except Exception:
        raise ApiError("UNSUPPORTED_IMAGE")

    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    elif img.mode == "L":
        img = img.convert("RGB")
    img.thumbnail((settings.MAX_IMAGE_EDGE, settings.MAX_IMAGE_EDGE), Image.LANCZOS)

    uid = uuid.uuid4().hex
    sources_dir = Path(settings.MEDIA_ROOT) / "sources"
    sources_dir.mkdir(parents=True, exist_ok=True)
    rel_name = f"{uid}.jpg"
    out_path = sources_dir / rel_name
    img.save(out_path, format="JPEG", quality=90)  # no EXIF written

    # The raw upload is never kept: close temp files Django created.
    try:
        uploaded_file.close()
    except Exception:
        pass

    thumb_rel = _save_thumb(img, f"{uid}.jpg")
    return SanitizedImage(
        path=out_path,
        rel_path=f"sources/{rel_name}",
        thumb_rel_path=thumb_rel,
        width=img.width,
        height=img.height,
        sha256=_sha256_of(out_path),
    )
