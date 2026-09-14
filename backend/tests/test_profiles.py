import pytest

from apps.profiles.models import MatchPreferences, PrivateProfile, Profile

pytestmark = pytest.mark.django_db


def test_profile_created_atomically_and_private_fields_hidden(signed_in, user, profile_payload):
    response = signed_in.put("/api/v1/profile/", profile_payload, format="json")
    assert response.status_code == 201
    assert PrivateProfile.objects.get(user=user).birth_date.isoformat() == "2000-01-01"
    assert MatchPreferences.objects.get(user=user).genders == ["woman"]
    serialized = str(response.data)
    for private in (user.email, "2000-01-01", "birth_date", "accepted_at", "user_id"):
        assert private not in serialized
    assert signed_in.get("/api/v1/me/").data["onboarding_complete"]
    alias = response.data["profile"]["alias"]
    assert signed_in.put("/api/v1/profile/", profile_payload, format="json").data["profile"]["alias"] == alias
    assert Profile.objects.count() == 1


@pytest.mark.parametrize(
    "field,value",
    [
        ("birth_date", "2020-01-01"),
        ("birth_date", "2099-01-01"),
        ("accepted_terms", False),
        ("accepted_guidelines", False),
        ("policy_version", "old"),
        ("interests", ["music", "music", "music"]),
        ("interests", ["music"]),
        ("avatar_id", "random-url"),
        ("gender", "invalid"),
        ("intentions", []),
        ("languages", ["garbage"]),
    ],
)
def test_invalid_profile_does_not_partially_save(signed_in, user, profile_payload, field, value):
    profile_payload[field] = value
    assert signed_in.put("/api/v1/profile/", profile_payload, format="json").status_code == 400
    assert not Profile.objects.filter(user=user).exists()
    assert not PrivateProfile.objects.filter(user=user).exists()
    assert not MatchPreferences.objects.filter(user=user).exists()


def test_birth_date_cannot_be_changed(signed_in, user, profile_payload):
    signed_in.put("/api/v1/profile/", profile_payload, format="json")
    profile_payload["birth_date"] = "1990-01-01"
    assert signed_in.put("/api/v1/profile/", profile_payload, format="json").status_code == 400
    assert PrivateProfile.objects.get(user=user).birth_date.isoformat() == "2000-01-01"


def test_invalid_age_range_rejected(signed_in, profile_payload):
    profile_payload["preferences"]["min_age"] = 45
    assert signed_in.put("/api/v1/profile/", profile_payload, format="json").status_code == 400


def test_owner_profile_requires_authentication(client, signed_in, profile_payload):
    signed_in.put("/api/v1/profile/", profile_payload, format="json")
    signed_in.logout()
    assert client.get("/api/v1/profile/").status_code == 403


def test_preferences_can_be_updated_without_resubmitting_birth_date(signed_in, profile_payload):
    signed_in.put("/api/v1/profile/", profile_payload, format="json")
    prefs = profile_payload["preferences"]
    prefs["open_chat_opt_in"] = True
    assert signed_in.put("/api/v1/preferences/", prefs, format="json").data["open_chat_opt_in"]


def test_public_catalog_and_identity_preview(client):
    assert client.get("/api/v1/catalog/").status_code == 200
    first = client.get("/api/v1/identity-preview/").data
    second = client.get("/api/v1/identity-preview/").data
    assert first["alias"] != second["alias"]
    assert set(first) == {"alias", "avatar_id"}
