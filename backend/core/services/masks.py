from __future__ import annotations

import hashlib
import uuid
from collections.abc import Mapping
from pathlib import Path
from typing import Any, NoReturn, cast

from django.conf import settings
from PIL import Image, ImageDraw, UnidentifiedImageError
from rest_framework import status

from common.http import err


MAX_STROKES = 200
MAX_POINTS = 5000
MIN_COVERAGE = 0.005
MAX_COVERAGE = 0.60
MASK_MIME_TYPE = "image/png"


def rasterize_strokes(
    strokes_payload: Mapping[str, Any],
    *,
    width: int,
    height: int,
) -> Image.Image:
    """Rasterize normalized paint/erase strokes to a source-sized binary mask."""
    if strokes_payload.get("version") != 1:
        _validation("strokes.version", "version must be 1.")

    strokes_value = strokes_payload.get("strokes")
    if not isinstance(strokes_value, list) or not strokes_value:
        _mask_empty()
    strokes = cast(list[Any], strokes_value)
    if len(strokes) > MAX_STROKES:
        _validation("strokes", "A maximum of 200 strokes is allowed.")

    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    total_points = 0

    for index, stroke in enumerate(strokes):
        if not isinstance(stroke, Mapping):
            _validation(f"strokes[{index}]", "Each stroke must be an object.")
        stroke = cast(Mapping[str, Any], stroke)
        mode = stroke.get("mode")
        if mode not in {"paint", "erase"}:
            _validation(
                f"strokes[{index}].mode",
                "Stroke mode must be paint or erase.",
            )
        try:
            brush_width = float(stroke["width"])
        except (KeyError, TypeError, ValueError):
            _validation(
                f"strokes[{index}].width",
                "Stroke width must be a number.",
            )
        if not 0 < brush_width <= 1:
            _validation(
                f"strokes[{index}].width",
                "Stroke width must be greater than 0 and at most 1.",
            )

        points = stroke.get("points")
        if not isinstance(points, list) or not points:
            _mask_empty()
        points = cast(list[Any], points)
        total_points += len(points)
        if total_points > MAX_POINTS:
            _validation("strokes", "A maximum of 5,000 points is allowed.")

        pixel_points = []
        for point_index, point in enumerate(points):
            if (
                not isinstance(point, (list, tuple))
                or len(point) != 2
            ):
                _validation(
                    f"strokes[{index}].points[{point_index}]",
                    "Each point must contain normalized x and y values.",
                )
            try:
                x, y = float(point[0]), float(point[1])
            except (TypeError, ValueError):
                _validation(
                    f"strokes[{index}].points[{point_index}]",
                    "Point coordinates must be numbers.",
                )
            if not 0 <= x <= 1 or not 0 <= y <= 1:
                _validation(
                    f"strokes[{index}].points[{point_index}]",
                    "Point coordinates must be between 0 and 1.",
                )
            pixel_points.append(
                (
                    round(x * (width - 1)),
                    round(y * (height - 1)),
                )
            )

        fill = 255 if mode == "paint" else 0
        line_width = max(1, round(brush_width * width))
        if len(pixel_points) == 1:
            x, y = pixel_points[0]
            radius = line_width / 2
            draw.ellipse(
                (x - radius, y - radius, x + radius, y + radius),
                fill=fill,
            )
        else:
            draw.line(
                pixel_points,
                fill=fill,
                width=line_width,
                joint="curve",
            )
            radius = line_width / 2
            for x, y in (pixel_points[0], pixel_points[-1]):
                draw.ellipse(
                    (x - radius, y - radius, x + radius, y + radius),
                    fill=fill,
                )

    return _validate_coverage(mask)


def save_mask_image(
    image: Image.Image,
    *,
    owner_id: Any,
    post_id: Any,
) -> dict[str, Any]:
    """Persist a validated grayscale mask and return asset fields."""
    output_dir = Path(settings.MEDIA_ROOT) / "masks"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{uuid.uuid4()}.png"
    image.save(output_path, format="PNG", optimize=True)
    return {
        "owner_id": owner_id,
        "post_id": post_id,
        "file_path": output_path.relative_to(Path(settings.MEDIA_ROOT)).as_posix(),
        "mime_type": MASK_MIME_TYPE,
        "width": image.width,
        "height": image.height,
        "sha256": _sha256(output_path),
    }


def sanitize_png_mask(upload: Any, *, width: int, height: int) -> Image.Image:
    """Read and validate a PNG mask uploaded at source dimensions."""
    upload_size = getattr(upload, "size", None)
    if upload_size is not None and upload_size > settings.MAX_UPLOAD_BYTES:
        err(
            "MASK_TOO_LARGE",
            status.HTTP_400_BAD_REQUEST,
            "The mask exceeds the allowed size.",
        )
    try:
        upload.seek(0)
        with Image.open(upload) as image:
            if (image.format or "").upper() != "PNG":
                _validation("mask", "The mask must be a PNG file.")
            if image.size != (width, height):
                err(
                    "MASK_SIZE_MISMATCH",
                    status.HTTP_400_BAD_REQUEST,
                    "The mask must match the source image dimensions.",
                )
            mask = image.convert("L").copy()
    except (UnidentifiedImageError, OSError, ValueError):
        _validation("mask", "The mask must be a valid PNG file.")
    return _validate_coverage(mask)


def _validate_coverage(mask: Image.Image) -> Image.Image:
    binary = mask.point(
        lambda value: 255 if cast(int, value) >= 128 else 0,
        mode="L",
    )
    painted = sum(binary.histogram()[128:])
    coverage = painted / (binary.width * binary.height)
    if painted == 0:
        _mask_empty()
    if coverage > MAX_COVERAGE:
        err(
            "MASK_TOO_LARGE",
            status.HTTP_400_BAD_REQUEST,
            "The painted mask area must be at most 60% of the image.",
        )
    if coverage < MIN_COVERAGE:
        _validation(
            "mask",
            "The painted mask area must be at least 0.5% of the image.",
        )
    return binary


def _validation(field: str, message: str) -> NoReturn:
    err(
        "VALIDATION_ERROR",
        status.HTTP_400_BAD_REQUEST,
        message,
        fields={field: [message]},
    )


def _mask_empty() -> NoReturn:
    err(
        "MASK_EMPTY",
        status.HTTP_400_BAD_REQUEST,
        "The mask must paint an area to edit.",
    )


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as output_file:
        for chunk in iter(lambda: output_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
