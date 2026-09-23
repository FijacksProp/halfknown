import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.profiles.catalog import AVATAR_GROUPS
from apps.profiles.models import MatchPreferences, PrivateProfile, Profile

pytestmark = pytest.mark.django_db


def random_access_payload(settings, **overrides):
    return {
        "gender": "undisclosed",
        "adult_confirmed": True,
        "accepted_terms": True,
        "accepted_guidelines": True,
        "policy_version": settings.POLICY_VERSION,
        **overrides,
    }


def test_guest_can_enter_random_chat_without_email(client, settings):
    response = client.post(
        "/api/v1/random-access/", random_access_payload(settings), format="json"
    )
    assert response.status_code == 201
    assert response.data["account"]["is_guest"] is True
    assert response.data["account"]["email"] == ""
    assert response.data["profile"]["intentions"] == ["conversation"]
    assert response.data["profile"]["interests"] == []
    assigned = response.data["profile"]
    assert assigned["avatar_group"] in AVATAR_GROUPS
    assert assigned["avatar_id"] in AVATAR_GROUPS[assigned["avatar_group"]]
    user = User.objects.get(pk=response.data["account"]["id"])
    assert user.email.endswith("@guest.halfknown.invalid")
    assert user.private_profile.birth_date is None
    assert user.private_profile.adult_confirmed_at
    assert client.post("/api/v1/matching/queue/", {}, format="json").data["state"] == "waiting"


@pytest.mark.parametrize(
    "change", [{"adult_confirmed": False}, {"accepted_terms": False}, {"accepted_guidelines": False}, {"policy_version": "old"}]
)
def test_guest_access_fails_closed(client, settings, change):
    response = client.post(
        "/api/v1/random-access/", random_access_payload(settings, **change), format="json"
    )
    assert response.status_code == 400
    assert not User.objects.exists()


def test_guest_creation_requires_csrf(settings):
    client = APIClient(enforce_csrf_checks=True)
    payload = random_access_payload(settings)
    assert client.post("/api/v1/random-access/", payload, format="json").status_code == 403
    token = client.get("/api/v1/auth/csrf/").data["csrf_token"]
    client.credentials(HTTP_X_CSRFTOKEN=token)
    assert client.post("/api/v1/random-access/", payload, format="json").status_code == 201


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


@pytest.mark.parametrize("gender,suffix", [("woman", "female"), ("man", "male")])
def test_new_profile_gets_matching_portrait_and_cannot_change_group(
    signed_in, profile_payload, gender, suffix
):
    profile_payload["gender"] = gender
    response = signed_in.put("/api/v1/profile/", profile_payload, format="json")
    assert response.status_code == 201
    assigned = response.data["profile"]
    assert assigned["avatar_id"] == f"{assigned['avatar_group']}-{suffix}"
    other_group = next(group for group in AVATAR_GROUPS if group != assigned["avatar_group"])
    rejected = signed_in.patch(
        "/api/v1/social/me/", {"avatar_id": f"{other_group}-{suffix}"}, format="json"
    )
    assert rejected.status_code == 400
    wrong_presentation = "male" if suffix == "female" else "female"
    assert signed_in.patch(
        "/api/v1/social/me/",
        {"avatar_id": f"{assigned['avatar_group']}-{wrong_presentation}"},
        format="json",
    ).status_code == 400
    assert signed_in.patch(
        "/api/v1/social/me/", {"avatar_id": assigned["avatar_id"]}, format="json"
    ).status_code == 200


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


def test_onboarding_post_never_overwrites_an_existing_profile(signed_in, user, profile_payload):
    created = signed_in.post("/api/v1/profile/", profile_payload, format="json")
    assert created.status_code == 201
    profile_payload["interests"] = ["gaming", "films", "fitness"]
    response = signed_in.post("/api/v1/profile/", profile_payload, format="json")
    assert response.status_code == 409
    assert Profile.objects.get(user=user).interests == created.data["profile"]["interests"]
    assert Profile.objects.count() == 1


def test_onboarding_post_requires_verification(client, profile_payload):
    assert client.post("/api/v1/profile/", profile_payload, format="json").status_code == 403
    assert not Profile.objects.exists()
