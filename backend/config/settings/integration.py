from .base import *  # noqa: F403

# Keep real PostgreSQL and Redis for concurrency/integration tests.
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
CELERY_TASK_ALWAYS_EAGER = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "testserver"]
