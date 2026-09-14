import os
from pathlib import Path

import environ

# Local defaults only. Production imports base directly and fails on missing secrets.
environ.Env.read_env(Path(__file__).resolve().parent.parent.parent / ".env", overwrite=False)
os.environ.setdefault("DJANGO_SECRET_KEY", "halfknown-local-only-never-use-in-production-2026")
os.environ.setdefault("DATABASE_URL", "sqlite:///db.sqlite3")

from .base import *  # noqa: E402,F403

DEBUG = True
EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.filebased.EmailBackend")  # noqa: F405
EMAIL_FILE_PATH = BASE_DIR / ".local-mail"  # noqa: F405
EMAIL_FILE_PATH.mkdir(exist_ok=True)
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
# Explicitly single-process local mode; Docker uses Redis and a real worker.
if not env.bool("USE_REDIS", default=False):  # noqa: F405
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
    CELERY_BROKER_URL = "memory://"
else:
    CELERY_TASK_ALWAYS_EAGER = False
