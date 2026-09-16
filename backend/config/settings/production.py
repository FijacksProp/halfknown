import ssl

from config.production_checks import validate_production

from .base import *  # noqa: F403

PUBLIC_ORIGIN = env("PUBLIC_ORIGIN", default="")  # noqa: F405
CACHE_REDIS_URL = env("CACHE_REDIS_URL", default="")  # noqa: F405
validate_production(globals())
DATABASES["default"].setdefault("OPTIONS", {}).update(sslmode="require", connect_timeout=5)  # noqa: F405
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
SECURE_REFERRER_POLICY = "same-origin"
CELERY_TASK_ALWAYS_EAGER = False
CELERY_BROKER_USE_SSL = {"ssl_cert_reqs": ssl.CERT_REQUIRED}
CELERY_BEAT_SCHEDULE = {
    "expire-matches": {"task": "apps.matching.tasks.expire_matches", "schedule": 15.0},
    "clear-expired-sessions": {"task": "apps.matching.tasks.clear_expired_sessions", "schedule": 86400.0},
}
# Set only behind a proxy that strips client-supplied forwarding headers.
if env.bool("TRUST_PROXY_SSL_HEADER", default=False):  # noqa: F405
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
