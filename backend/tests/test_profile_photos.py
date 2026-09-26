import io
from importlib import import_module

import pytest
from django.apps import apps
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.profiles.models import Profile

pytestmark = pytest.mark.django_db


def profile_for(user):
    return Profile.objects.create(
        user=user,
        alias=f"person_{user.pk.hex[:8]}",
        avatar_group="alien",
        avatar_id="alien-female",
        gender="woman",
        intentions=["friendship"],
        interests=["music"],
        languages=["en"],
        conversation_style="playful",
    )


def photo_file(size=(400, 400)):
    content = io.BytesIO()
    Image.new("RGB", size, "#db6d69").save(content, format="JPEG")
    return SimpleUploadedFile("portrait.jpg", content.getvalue(), content_type="image/jpeg")


def test_photo_is_optional_for_quick_meet_but_required_for_discover(signed_in, user):
    profile = profile_for(user)
    assert signed_in.patch("/api/v1/social/me/", {"discoverable": True}).status_code == 400
    result = signed_in.post("/api/v1/social/me/photo/", {"photo": photo_file()}, format="multipart")
    assert result.status_code == 200
    assert result.data["photo_status"] == "pending"
    assert result.data["discoverable"] is False
    assert signed_in.patch("/api/v1/social/me/", {"discoverable": True}).status_code == 400
    profile.refresh_from_db()
    assert profile.photo.name.endswith(".webp")
    owner_photo = signed_in.get(result.data["photo_url"])
    assert owner_photo.status_code == 200
    owner_photo.close()

    viewer = User.objects.create_user("viewer-photo@example.com", email_verified_at=timezone.now())
    profile_for(viewer)
    viewer_client = APIClient()
    viewer_client.force_login(viewer)
    assert viewer_client.get(result.data["photo_url"]).status_code == 404
    assert viewer_client.get("/api/v1/social/discover/").data["results"] == []

    staff = User.objects.create_superuser("reviewer@example.com", password="unused-test-password")
    staff_client = APIClient()
    staff_client.force_login(staff)
    review_photo = staff_client.get(result.data["photo_url"])
    assert review_photo.status_code == 200
    review_photo.close()

    profile.photo_status = "approved"
    profile.save(update_fields=["photo_status"])
    assert signed_in.patch("/api/v1/social/me/", {"discoverable": True}).status_code == 200
    public_photo = viewer_client.get(result.data["photo_url"])
    assert public_photo.status_code == 200
    public_photo.close()
    assert viewer_client.get("/api/v1/social/discover/").data["results"][0]["id"] == str(profile.pk)

    removed = signed_in.delete("/api/v1/social/me/photo/")
    assert removed.status_code == 200
    assert removed.data["discoverable"] is False
    assert removed.data["photo_url"] is None
    assert viewer_client.get(result.data["photo_url"]).status_code == 404


def test_rejects_invalid_photo_without_changing_profile(signed_in, user):
    profile = profile_for(user)
    invalid = SimpleUploadedFile("fake.jpg", b"not-an-image", content_type="image/jpeg")
    assert (
        signed_in.post("/api/v1/social/me/photo/", {"photo": invalid}, format="multipart").status_code == 400
    )
    assert (
        signed_in.post(
            "/api/v1/social/me/photo/", {"photo": photo_file((100, 100))}, format="multipart"
        ).status_code
        == 400
    )
    profile.refresh_from_db()
    assert not profile.photo
    assert profile.photo_status == "none"


def test_retired_human_group_is_reassigned_and_hidden(user):
    profile = profile_for(user)
    profile.avatar_group = "human"
    profile.avatar_id = "human-female"
    profile.discoverable = True
    profile.save(update_fields=["avatar_group", "avatar_id", "discoverable"])
    migration = import_module("apps.profiles.migrations.0006_profile_photo_and_retire_humans")
    migration.retire_human_avatars(apps, type("Editor", (), {"connection": connection})())
    profile.refresh_from_db()
    assert profile.avatar_group != "human"
    assert profile.avatar_id == f"{profile.avatar_group}-female"
    assert profile.discoverable is False
