from io import BytesIO
from pathlib import Path
from typing import cast

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image

from common.http import ApiError
from core.services.images import sanitize_upload


class ImageServiceTests(TestCase):
    def _upload(self, content: bytes, name: str = "upload.bin") -> SimpleUploadedFile:
        return SimpleUploadedFile(name, content)

    @override_settings(MAX_UPLOAD_BYTES=1024, MAX_IMAGE_EDGE=100)
    def test_sanitizes_and_resizes_jpeg(self):
        source = BytesIO()
        Image.new("RGBA", (200, 150), (255, 0, 0, 128)).save(source, "PNG")
        upload = self._upload(source.getvalue(), "source.png")

        result = sanitize_upload(upload)
        output_path = Path(settings.MEDIA_ROOT) / result["path"]

        self.assertEqual(result["mime_type"], "image/jpeg")
        self.assertEqual((result["width"], result["height"]), (100, 75))
        self.assertEqual(len(result["sha256"]), 64)
        self.assertTrue(output_path.exists())
        with Image.open(output_path) as output:
            self.assertEqual(output.format, "JPEG")
            self.assertEqual(output.getexif(), {})

    @override_settings(MAX_UPLOAD_BYTES=10)
    def test_rejects_oversized_upload(self):
        upload = self._upload(b"x" * 11)

        with self.assertRaises(ApiError) as raised:
            sanitize_upload(upload)

        self.assertEqual(raised.exception.code, "IMAGE_TOO_LARGE")
        self.assertEqual(raised.exception.status_code, 413)

    def test_rejects_non_image_upload(self):
        upload = self._upload(b"not an image")

        with self.assertRaises(ApiError) as raised:
            sanitize_upload(upload)

        self.assertEqual(raised.exception.code, "UNSUPPORTED_IMAGE")
        self.assertEqual(raised.exception.status_code, 415)

    @override_settings(MAX_UPLOAD_BYTES=1024 * 1024)
    def test_calculates_hash_of_stored_bytes(self):
        source = BytesIO()
        Image.new("RGB", (20, 20), "blue").save(source, "JPEG")
        upload = self._upload(source.getvalue(), "source.jpg")

        result = sanitize_upload(upload)
        output_path = Path(settings.MEDIA_ROOT) / result["path"]

        import hashlib

        expected = hashlib.sha256(output_path.read_bytes()).hexdigest()
        self.assertEqual(result["sha256"], expected)
        self.assertIsNone(result["latitude"])
        self.assertIsNone(result["longitude"])
        self.assertEqual(result["location_source"], "none")

    def test_extracts_exif_gps_before_stripping_metadata(self):
        source = BytesIO()
        image = Image.new("RGB", (20, 20), "green")
        exif = Image.Exif()
        exif[34853] = {
            1: "N",
            2: (40.0, 26.0, 0.0),
            3: "W",
            4: (73.0, 58.0, 0.0),
        }
        image.save(source, "JPEG", exif=exif)
        upload = self._upload(source.getvalue(), "with-gps.jpg")

        result = sanitize_upload(upload)

        self.assertIsNotNone(result["latitude"])
        self.assertIsNotNone(result["longitude"])
        self.assertAlmostEqual(cast(float, result["latitude"]), 40.4333, places=3)
        self.assertAlmostEqual(cast(float, result["longitude"]), -73.9667, places=3)
        self.assertEqual(result["location_source"], "exif")
