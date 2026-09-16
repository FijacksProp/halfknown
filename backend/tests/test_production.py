from unittest.mock import patch

import pytest
from django.core.exceptions import ImproperlyConfigured

from config.production_checks import validate_production


@pytest.fixture
def production_config():
    return {
        "DEBUG": False,
        "SECRET_KEY": "test-only-" * 8,
        "DATABASES": {"default": {"ENGINE": "django.db.backends.postgresql"}},
        "ALLOWED_HOSTS": ["halfknown.test"],
        "PUBLIC_ORIGIN": "https://halfknown.test",
        "CSRF_TRUSTED_ORIGINS": ["https://halfknown.test"],
        "WS_ALLOWED_ORIGINS": ["https://halfknown.test"],
        "REDIS_URL": "rediss://default:test-secret@redis.test:6379/0",
        "CACHE_REDIS_URL": "rediss://default:test-secret@redis.test:6379/1",
        "CELERY_BROKER_URL": "rediss://default:test-secret@redis.test:6379/2",
        "EMAIL_BACKEND": "django.core.mail.backends.smtp.EmailBackend",
        "EMAIL_HOST": "smtp.test",
        "EMAIL_USE_TLS": True,
        "EMAIL_USE_SSL": False,
        "DEFAULT_FROM_EMAIL": "hello@halfknown.test",
        "POLICY_VERSION": "2026-09-16",
        "TERMS_URL": "https://halfknown.test/terms",
        "PRIVACY_URL": "https://halfknown.test/privacy",
        "GUIDELINES_URL": "https://halfknown.test/guidelines",
    }


def test_complete_production_configuration(production_config):
    validate_production(production_config)


@pytest.mark.parametrize(
    "key,value",
    [
        ("DEBUG", True),
        ("SECRET_KEY", "local-only"),
        ("ALLOWED_HOSTS", ["*"]),
        ("PUBLIC_ORIGIN", "http://halfknown.test"),
        ("WS_ALLOWED_ORIGINS", ["*"]),
        ("CSRF_TRUSTED_ORIGINS", []),
        ("REDIS_URL", "redis://localhost:6379"),
        ("CACHE_REDIS_URL", "rediss://redis.test:6379"),
        ("CELERY_BROKER_URL", "memory://"),
        ("EMAIL_HOST", "localhost"),
        ("EMAIL_USE_SSL", True),
        ("DEFAULT_FROM_EMAIL", "noreply@localhost"),
        ("EMAIL_BACKEND", "django.core.mail.backends.filebased.EmailBackend"),
        ("POLICY_VERSION", "development-draft-1"),
        ("TERMS_URL", ""),
        ("PRIVACY_URL", "javascript:alert(1)"),
        ("GUIDELINES_URL", "http://halfknown.test/rules"),
        ("DATABASES", {"default": {"ENGINE": "django.db.backends.sqlite3"}}),
    ],
)
def test_incomplete_or_unsafe_configuration_is_rejected(production_config, key, value):
    production_config[key] = value
    with pytest.raises(ImproperlyConfigured) as error:
        validate_production(production_config)
    assert "test-secret" not in str(error.value)


@pytest.mark.django_db
def test_readiness_is_private_and_fails_closed(client):
    response = client.get("/health/ready/")
    assert response.status_code == 200
    assert response["Cache-Control"] == "no-store"
    with patch("config.health.cache.get", side_effect=RuntimeError("private infrastructure detail")):
        response = client.get("/health/ready/")
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}
