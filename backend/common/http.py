import logging
from typing import NoReturn

from rest_framework import status
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    NotAuthenticated,
    NotFound,
    Throttled,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


logger = logging.getLogger(__name__)


class ApiError(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "VALIDATION_ERROR"
    default_detail = "The request is invalid."

    def __init__(
        self,
        code,
        message,
        http_status=status.HTTP_400_BAD_REQUEST,
        retryable=False,
        field_errors=None,
    ):
        self.status_code = http_status
        self.default_code = code
        self.code = code
        self.retryable = retryable
        self.field_errors = field_errors or {}
        super().__init__(detail=message, code=code)


def err(code, http_status, message, retryable=False, fields=None) -> NoReturn:
    raise ApiError(
        code=code,
        message=message,
        http_status=http_status,
        retryable=retryable,
        field_errors=fields,
    )


def exception_handler(exc, context):
    if isinstance(exc, ApiError):
        return _error_response(exc)

    response = drf_exception_handler(exc, context)
    if response is None:
        logger.exception("Unhandled API exception", exc_info=exc)
        return Response(
            _error_body(
                code="INTERNAL",
                message="Unexpected server error.",
                retryable=True,
            ),
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response(
        _error_body(
            code=_map_exception_code(exc),
            message=_message_from_response(response),
            retryable=_is_retryable(exc),
            field_errors=_field_errors_from_response(response),
        ),
        status=response.status_code,
    )


def _error_response(exc):
    return Response(
        _error_body(
            code=exc.code,
            message=str(exc.detail),
            retryable=exc.retryable,
            field_errors=exc.field_errors,
        ),
        status=exc.status_code,
    )


def _error_body(code, message, retryable, field_errors=None):
    return {
        "error": {
            "code": code,
            "message": message,
            "retryable": retryable,
            "fieldErrors": field_errors or {},
        }
    }


def _map_exception_code(exc):
    if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
        return "AUTH_REQUIRED"
    if isinstance(exc, (NotFound,)):
        return "NOT_FOUND"
    if isinstance(exc, Throttled):
        return "RATE_LIMITED"
    if isinstance(exc, ValidationError):
        return "VALIDATION_ERROR"
    return "INTERNAL"


def _is_retryable(exc):
    return isinstance(exc, Throttled)


def _message_from_response(response):
    data = response.data
    if isinstance(data, dict):
        detail = data.get("detail")
        if detail is not None:
            return str(detail)
        return "The request is invalid."
    return str(data)


def _field_errors_from_response(response):
    data = response.data
    if not isinstance(data, dict):
        return {}

    field_errors = {}
    for field, value in data.items():
        if field == "detail":
            continue
        field_errors[field] = value if isinstance(value, list) else [value]
    return field_errors
