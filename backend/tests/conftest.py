import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User


@pytest.fixture(autouse=True)
def reset_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def user(db):
    return User.objects.create_user("person@example.com", email_verified_at=timezone.now())


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def signed_in(client, user):
    client.force_login(user)
    return client


@pytest.fixture
def profile_payload(settings):
    return {
        "username": "sampleperson",
        "birth_date": "2000-01-01",
        "accepted_terms": True,
        "accepted_guidelines": True,
        "policy_version": settings.POLICY_VERSION,
        "gender": "man",
        "intentions": ["dating", "friendship"],
        "interests": ["music", "art", "books"],
        "languages": ["en"],
        "conversation_style": "playful",
        "prompt_answer": "Music for rainy days.",
        "preferences": {"genders": ["woman"], "min_age": 18, "max_age": 40, "open_chat_opt_in": False},
    }
