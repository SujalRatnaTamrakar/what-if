from django.urls import path

from core.views.config import public_config
from core.views.health import health
from core.views.me import me


urlpatterns = [
    path("health", health, name="health"),
    path("config", public_config, name="public-config"),
    path("me", me, name="me"),
]
