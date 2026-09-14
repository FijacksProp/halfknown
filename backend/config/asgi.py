import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")

from django.core.asgi import get_asgi_application  # noqa: E402

django_application = get_asgi_application()

from channels.auth import AuthMiddlewareStack  # noqa: E402
from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import OriginValidator  # noqa: E402
from django.conf import settings  # noqa: E402
from django.urls import path  # noqa: E402

from apps.realtime.consumers import AccountConsumer  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_application,
        "websocket": OriginValidator(
            AuthMiddlewareStack(URLRouter([path("ws/events/", AccountConsumer.as_asgi())])),
            settings.WS_ALLOWED_ORIGINS,
        ),
    }
)
