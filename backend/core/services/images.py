from __future__ import annotations

import hashlib
import uuid
from pathlib import Path
from typing import IO, TypedDict

import pillow_heif
from django.conf import settings
from PIL import Image, ImageOps, UnidentifiedImageError
from PIL.ExifTags import GPSTAGS, IFD
from PIL.Image import DecompressionBombError
from rest_framework import status

from common.http import err


pillow_heif.register_heif_opener()

SUPPORTED_INPUT_FORMATS = {"JPEG", "PNG", "WEBP", "HEIC", "HEIF"}
OUTPUT_FORMAT = "JPEG"
OUTPUT_MIME_TYPE = "image/jpeg"
JPEG_QUALITY = 90


class SanitizedUpload(TypedDict):
    path: str
    mime_type: str
    width: int
    height: int
    sha256: str
    latitude: float | None
    longitude: float | None
    location_source: str


def sanitize_upload(upload: IO[bytes]) -> SanitizedUpload:
    """Validate, sanitize, and persist an uploaded image."""
    upload_size = getattr(upload, "size", None)
    if upload_size is not None and upload_size > settings.MAX_UPLOAD_BYTES:
        err(
            "IMAGE_TOO_LARGE",
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            "The image exceeds the maximum upload size.",
        )

    try:
        upload.seek(0)
        with Image.open(upload) as image:
            image_format = (image.format or "").upper()
            if image_format not in SUPPORTED_INPUT_FORMATS:
                err(
                    "UNSUPPORTED_IMAGE",
                    status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    "The uploaded file is not a supported image.",
                )

            latitude, longitude = _extract_gps(image)
            sanitized = ImageOps.exif_transpose(image).convert("RGB")
            sanitized.thumbnail(
                (settings.MAX_IMAGE_EDGE, settings.MAX_IMAGE_EDGE),
                Image.Resampling.LANCZOS,
            )

            output_dir = Path(settings.MEDIA_ROOT) / "sources"
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / f"{uuid.uuid4()}.jpg"
            sanitized.save(
                output_path,
                format=OUTPUT_FORMAT,
                quality=JPEG_QUALITY,
                optimize=True,
            )
            width, height = sanitized.size
    except (UnidentifiedImageError, DecompressionBombError, OSError, ValueError):
        err(
            "UNSUPPORTED_IMAGE",
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "The uploaded file is not a supported image.",
        )

    digest = _sha256(output_path)
    relative_path = output_path.relative_to(Path(settings.MEDIA_ROOT))
    return {
        "path": relative_path.as_posix(),
        "mime_type": OUTPUT_MIME_TYPE,
        "width": width,
        "height": height,
        "sha256": digest,
        "latitude": latitude,
        "longitude": longitude,
        "location_source": "exif" if latitude is not None else "none",
    }


def _extract_gps(image: Image.Image) -> tuple[float | None, float | None]:
    exif = image.getexif()
    try:
        gps_info = exif.get_ifd(IFD.GPSInfo)
    except (KeyError, AttributeError):
        return None, None
    if not gps_info:
        return None, None

    gps = {
        GPSTAGS.get(key, key): value
        for key, value in gps_info.items()
    }
    try:
        latitude = _coordinate(gps["GPSLatitude"], gps["GPSLatitudeRef"])
        longitude = _coordinate(gps["GPSLongitude"], gps["GPSLongitudeRef"])
    except (KeyError, TypeError, ValueError, ZeroDivisionError):
        return None, None

    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        return None, None
    return latitude, longitude


def _coordinate(value: object, reference: object) -> float:
    degrees, minutes, seconds = value  # type: ignore[misc]
    coordinate = float(degrees) + float(minutes) / 60 + float(seconds) / 3600
    if str(reference).upper() in {"S", "W"}:
        coordinate *= -1
    return coordinate


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as output_file:
        for chunk in iter(lambda: output_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()