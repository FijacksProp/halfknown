import re
import uuid
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.core import mail
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import LoginChallenge, User
from apps.accounts.services import request_code, verify_code

pytestmark = pytest.mark.django_db


def code_from_mail():
    return re.search(r"\b\d{6}\b", mail.outbox[-1].body).group()


def test_passwordless_roundtrip_and_replay(client, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        response = client.post("/api/v1/auth/request-code/", {"email": "HELLO@example.com"})
    assert response.status_code == 202
    challenge_id = response.data["challenge_id"]
    code = code_from_mail()
    user = User.objects.get(email="hello@example.com")
    assert not user.has_usable_password()
    assert not user.email_verified_at
    assert code not in str(response.data)
    assert LoginChallenge.objects.get(user=user).code_digest != code
    payload = {"challenge_id": challenge_id, "code": code}
    response = client.post("/api/v1/auth/verify-code/", payload)
    assert response.status_code == 200
    assert response.cookies["halfknown_session"]["httponly"]
    assert client.get("/api/v1/me/").data["email"] == "hello@example.com"
    assert client.post("/api/v1/auth/verify-code/", payload).status_code == 400
    assert client.post("/api/v1/auth/logout/").status_code == 204
    assert client.get("/api/v1/me/").status_code == 403


def test_wrong_attempts_lock_challenge(django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        challenge_id = request_code("test@example.com")
    code = code_from_mail()
    wrong = "999999" if code != "999999" else "000000"
    for _ in range(5):
        assert verify_code(challenge_id, wrong) is None
    assert verify_code(challenge_id, code) is None
    assert LoginChallenge.objects.get(challenge_id=challenge_id).attempts == 5


def test_expired_code(django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        challenge_id = request_code("test@example.com")
    LoginChallenge.objects.filter(challenge_id=challenge_id).update(expires_at=timezone.now())
    assert verify_code(challenge_id, code_from_mail()) is None


def test_resend_cooldown_and_old_code_invalidation(django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        first = request_code("test@example.com")
        duplicate = request_code("TEST@example.com")
    assert first == duplicate
    assert len(mail.outbox) == 1
    old_code = code_from_mail()
    LoginChallenge.objects.filter(challenge_id=first).update(sent_at=timezone.now() - timedelta(minutes=2))
    with django_capture_on_commit_callbacks(execute=True):
        second = request_code("test@example.com")
    assert first != second
    assert verify_code(first, old_code) is None
    assert verify_code(second, code_from_mail()) is not None


def test_hourly_account_limit(django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        challenge_id = request_code("test@example.com")
    LoginChallenge.objects.filter(challenge_id=challenge_id).update(
        sent_at=timezone.now() - timedelta(minutes=2),
        sends_in_window=5,
    )
    with django_capture_on_commit_callbacks(execute=True):
        request_code("test@example.com")
    assert len(mail.outbox) == 1


def test_disabled_account_does_not_receive_code(client, user):
    user.is_active = False
    user.save()
    with patch("apps.accounts.tasks.send_mail") as sender:
        response = client.post("/api/v1/auth/request-code/", {"email": user.email})
    assert response.status_code == 202
    assert not sender.called
    assert not LoginChallenge.objects.filter(user=user).exists()


def test_anonymous_login_requires_csrf(django_capture_on_commit_callbacks):
    client = APIClient(enforce_csrf_checks=True)
    assert client.post("/api/v1/auth/request-code/", {"email": "test@example.com"}).status_code == 403
    csrf = client.get("/api/v1/auth/csrf/").data["csrf_token"]
    with django_capture_on_commit_callbacks(execute=True):
        response = client.post(
            "/api/v1/auth/request-code/", {"email": "test@example.com"}, HTTP_X_CSRFTOKEN=csrf
        )
    assert response.status_code == 202
    payload = {"challenge_id": response.data["challenge_id"], "code": code_from_mail()}
    assert client.post("/api/v1/auth/verify-code/", payload).status_code == 403
    verified = client.post("/api/v1/auth/verify-code/", payload, HTTP_X_CSRFTOKEN=csrf)
    assert verified.status_code == 200
    assert client.post("/api/v1/auth/logout/", HTTP_X_CSRFTOKEN=csrf).status_code == 403
    assert (
        client.post("/api/v1/auth/logout/", HTTP_X_CSRFTOKEN=verified.data["csrf_token"]).status_code == 204
    )


@pytest.mark.parametrize("code", ["1", "1234567", "aaaaaa", ""])
def test_malformed_codes_rejected(client, code):
    assert (
        client.post(
            "/api/v1/auth/verify-code/", {"challenge_id": str(uuid.uuid4()), "code": code}
        ).status_code
        == 400
    )


def test_email_uniqueness_is_case_insensitive(user):
    with pytest.raises(IntegrityError), transaction.atomic():
        User.objects.create(email="PERSON@example.com")


def test_unverified_user_cannot_access_profile(client):
    user = User.objects.create_user("unverified@example.com")
    client.force_login(user)
    assert client.get("/api/v1/profile/").status_code == 403


def test_request_endpoint_is_ip_throttled(client, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        for i in range(10):
            assert (
                client.post("/api/v1/auth/request-code/", {"email": f"p{i}@example.com"}).status_code == 202
            )
    assert client.post("/api/v1/auth/request-code/", {"email": "last@example.com"}).status_code == 429
