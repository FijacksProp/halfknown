from email.utils import parseaddr
from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.core.validators import validate_email


def validate_production(config):
    """Fail closed without including secret values in error messages."""
    errors = []
    secret = config.get("SECRET_KEY", "")
    if config.get("DEBUG"):
        errors.append("DEBUG must be disabled")
    if len(secret) < 50 or "local-only" in secret:
        errors.append("DJANGO_SECRET_KEY must be a unique secret of at least 50 characters")
    if config["DATABASES"]["default"]["ENGINE"] != "django.db.backends.postgresql":
        errors.append("DATABASE_URL must select PostgreSQL")
    hosts = config.get("ALLOWED_HOSTS", [])
    if not hosts or any(h in {"*", "localhost", "127.0.0.1", "[::1]"} or h.startswith(".") for h in hosts):
        errors.append("DJANGO_ALLOWED_HOSTS must list explicit production hostnames")
    origin = config.get("PUBLIC_ORIGIN", "")
    parsed = urlsplit(origin)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.path
        or parsed.query
        or parsed.fragment
        or parsed.username
        or parsed.password
        or parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    ):
        errors.append("PUBLIC_ORIGIN must be an exact HTTPS origin without a trailing slash")
    for key in ("CSRF_TRUSTED_ORIGINS", "WS_ALLOWED_ORIGINS"):
        if config.get(key) != [origin]:
            errors.append(f"{key} must contain only PUBLIC_ORIGIN")
    for key in ("REDIS_URL", "CACHE_REDIS_URL", "CELERY_BROKER_URL"):
        address = urlsplit(config.get(key, ""))
        if address.scheme != "rediss" or not address.hostname or not address.password:
            errors.append(f"{key} must use authenticated Redis over TLS (rediss)")
    if config.get("EMAIL_BACKEND") != "django.core.mail.backends.smtp.EmailBackend":
        errors.append("EMAIL_BACKEND must deliver through SMTP")
    if config.get("EMAIL_HOST", "") in {"", "localhost", "127.0.0.1"}:
        errors.append("EMAIL_HOST must be configured for delivery")
    if bool(config.get("EMAIL_USE_TLS")) == bool(config.get("EMAIL_USE_SSL")):
        errors.append("Enable exactly one of EMAIL_USE_TLS and EMAIL_USE_SSL")
    try:
        sender = parseaddr(config.get("DEFAULT_FROM_EMAIL", ""))[1]
        validate_email(sender)
        if sender.rsplit("@", 1)[-1] in {"localhost", "example.com"}:
            raise ValueError
    except (ValueError, ValidationError):
        errors.append("DEFAULT_FROM_EMAIL must use your verified sending domain")
    version = config.get("POLICY_VERSION", "")
    if not version or "draft" in version.lower() or "development" in version.lower():
        errors.append("POLICY_VERSION must identify the reviewed launch policies")
    for key in ("TERMS_URL", "PRIVACY_URL", "GUIDELINES_URL"):
        url = urlsplit(config.get(key, ""))
        if url.scheme != "https" or not url.hostname or url.username or url.password:
            errors.append(f"{key} must link to the published HTTPS policy")
    if errors:
        raise ImproperlyConfigured("Production configuration incomplete: " + "; ".join(errors))
