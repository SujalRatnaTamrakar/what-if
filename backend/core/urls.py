from django.urls import path

from core.views.config import public_config
from core.views.health import health
from core.views.me import me
from core.views.media import media
from core.views.posts import create_post


urlpatterns = [
    path("health", health, name="health"),
    path("config", public_config, name="public-config"),
    path("me", me, name="me"),
    path("media/<uuid:asset_id>", media, name="media"),
    path("posts", create_post, name="create-post"),
]
