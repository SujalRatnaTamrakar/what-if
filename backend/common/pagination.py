import base64
import json

from common.http import err


def encode_cursor(payload):
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_cursor(value):
    if not value:
        return None

    try:
        padding = "=" * (-len(value) % 4)
        raw = base64.urlsafe_b64decode((value + padding).encode("ascii"))
        decoded = json.loads(raw.decode("utf-8"))
    except (
        ValueError,
        TypeError,
        UnicodeDecodeError,
        json.JSONDecodeError,
        base64.binascii.Error,
    ) as exc:
        err("VALIDATION_ERROR", 400, "Invalid cursor.")
        raise AssertionError("unreachable") from exc

    if not isinstance(decoded, dict):
        err("VALIDATION_ERROR", 400, "Invalid cursor.")
    return decoded
