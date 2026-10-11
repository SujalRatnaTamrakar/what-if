"""PlacePatch Django settings.

Single config reader for the backend (§6.1 of the master plan).
Every value comes from the environment (backend/.env in dev).
Never hardcode URLs, keys, model names or provider choices elsewhere.
"""
from __future__ import annotations

import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
REPO_ROOT = BASE_DIR.parent

load_dotenv(BASE_DIR / ".env")


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, "") or default)
    except ValueError:
        return default


def env_bool(name: str, default: bool = False) -> bool:
    return (os.environ.get(name, "") or "").strip().lower() in {"1", "true", "yes", "on"} if os.environ.get(name) else default


SECRET_KEY = env("DJANGO_SECRET_KEY") or "dev-insecure-placepatch-secret-key"
DEBUG = env_bool("DJANGO_DEBUG", True)

ALLOWED_HOSTS = [h.strip() for h in env("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "rest_framework",
    "corsheaders",
    "core",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

APPEND_SLASH = False

# --- Database: sqlite for dev speed, Postgres/Tiger for prod parity (§2). ---
DATABASE_URL = env("DATABASE_URL") or f"sqlite:///{BASE_DIR / 'db.sqlite3'}"
DATABASES = {"default": dj_database_url.parse(DATABASE_URL, conn_max_age=0)}
# File-based test DB so threaded tests (support race) share one database.
DATABASES["default"]["TEST"] = {"NAME": str(BASE_DIR / "test_db.sqlite3")}
if DATABASES["default"]["ENGINE"] == "django.db.backends.sqlite3":
    DATABASES["default"].setdefault("OPTIONS", {})
    DATABASES["default"]["OPTIONS"]["timeout"] = 30

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_TZ = True
TIME_ZONE = "UTC"

# --- DRF (§9.5 step 1) ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["core.auth.Auth0JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "EXCEPTION_HANDLER": "core.exceptions.handler",
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {"anon": "60/min", "user": "120/min"},
}

# --- CORS ---
CORS_ALLOWED_ORIGINS = [o.strip() for o in env("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]
CORS_ALLOW_ALL_ORIGINS = env_bool("CORS_ALLOW_ALL_DEV", False) and DEBUG

# --- PlacePatch knobs (§6.1) ---
PUBLIC_BASE_URL = env("PUBLIC_BASE_URL", "http://localhost:8000").rstrip("/")
APP_PUBLIC_WEB_URL = env("APP_PUBLIC_WEB_URL", "")
MEDIA_ROOT = Path(env("MEDIA_ROOT", str(BASE_DIR / "media")))
MEDIA_URL_TTL_SECONDS = env_int("MEDIA_URL_TTL_SECONDS", 3600)
MAX_UPLOAD_BYTES = env_int("MAX_UPLOAD_BYTES", 15728640)
MAX_IMAGE_EDGE = env_int("MAX_IMAGE_EDGE", 2048)

AUTH0_DOMAIN = env("AUTH0_DOMAIN", "placepatch.us.auth0.com")
AUTH0_AUDIENCE = env("AUTH0_AUDIENCE", "https://api.placepatch.dev")
AUTH_DEV_BYPASS = env_bool("AUTH_DEV_BYPASS", False)

JOB_LEASE_SECONDS = env_int("JOB_LEASE_SECONDS", 300)
JOB_MAX_ATTEMPTS = env_int("JOB_MAX_ATTEMPTS", 2)
WORKER_POLL_SECONDS = env_int("WORKER_POLL_SECONDS", 1)

SCENE_PROVIDER = env("SCENE_PROVIDER", "fake")
DRAFT_PROVIDER = env("DRAFT_PROVIDER", "fake")
REVIEW_PROVIDER = env("REVIEW_PROVIDER", "fake")
RENDER_PROVIDER = env("RENDER_PROVIDER", "fake")
# Fallback chains (used when the matching *_PROVIDER is "fallback").
SCENE_CHAIN = env("SCENE_CHAIN", "gemini,openai,ollama")
DRAFT_CHAIN = env("DRAFT_CHAIN", "gemini,openai,ollama")
REVIEW_CHAIN = env("REVIEW_CHAIN", "gemini,openai,ollama")
RENDER_CHAIN = env("RENDER_CHAIN", "gemini_image,openai_image,comfyui")

OLLAMA_BASE_URL = env("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_VISION_MODEL = env("OLLAMA_VISION_MODEL", "qwen2.5vl:7b")
OLLAMA_TEXT_MODEL = env("OLLAMA_TEXT_MODEL", "llama3.1:8b")
OLLAMA_TIMEOUT_SECONDS = env_int("OLLAMA_TIMEOUT_SECONDS", 90)

GEMINI_API_KEY = env("GEMINI_API_KEY", "")
GEMINI_MODEL = env("GEMINI_MODEL", "")
GEMINI_IMAGE_MODEL = env("GEMINI_IMAGE_MODEL", "")
GEMINI_TIMEOUT_SECONDS = env_int("GEMINI_TIMEOUT_SECONDS", 60)

OPENAI_API_KEY = env("OPENAI_API_KEY", "")
OPENAI_MODEL = env("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_IMAGE_MODEL = env("OPENAI_IMAGE_MODEL", "gpt-image-1")
OPENAI_TIMEOUT_SECONDS = env_int("OPENAI_TIMEOUT_SECONDS", 60)

COMFYUI_BASE_URL = env("COMFYUI_BASE_URL", "http://localhost:8188")
COMFYUI_WORKFLOW = env("COMFYUI_WORKFLOW", "workflows/shade_inpaint_v1.api.json")
COMFYUI_TIMEOUT_SECONDS = env_int("COMFYUI_TIMEOUT_SECONDS", 240)

RENDER_WORK_EDGE = env_int("RENDER_WORK_EDGE", 1024)
RENDER_FEATHER_PX = env_int("RENDER_FEATHER_PX", 12)
ANALYTICS_ENABLED = env_bool("ANALYTICS_ENABLED", True)

AI_DISCLOSURE = "AI illustration \u2014 not an engineering design."

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
