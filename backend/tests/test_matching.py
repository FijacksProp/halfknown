from datetime import date

import pytest
from django.utils import timezone

from apps.accounts.models import User
from apps.matching.eligibility import eligible
from apps.moderation.models import Block
from apps.profiles.catalog import age_on
from apps.profiles.models import MatchPreferences, PrivateProfile, Profile

pytestmark = pytest.mark.django_db


@pytest.fixture
def pair():
    users = []
    for name, gender, wanted in [("alex", "man", "woman"), ("maya", "woman", "man")]:
        user = User.objects.create_user(f"{name}@example.com", email_verified_at=timezone.now())
        Profile.objects.create(
            user=user, gender=gender, avatar_id="alien-01", intentions=["dating"], languages=["en"]
        )
        PrivateProfile.objects.create(user=user, birth_date=date(2000, 1, 1), policy_version="draft")
        MatchPreferences.objects.create(
            user=user, genders=[wanted], min_age=18, max_age=40, open_chat_opt_in=True
        )
        users.append(user)
    return users


def test_random_matching_ignores_gender_preferences(pair):
    a, b = pair
    assert eligible(a, b)
    b.preferences.genders = ["woman"]
    b.preferences.open_chat_opt_in = False
    assert eligible(a, b)
    assert eligible(b, a)


def test_random_matching_ignores_profile_scoring_fields(pair):
    a, b = pair
    b.preferences.min_age = 40
    b.profile.languages = ["fr"]
    b.profile.intentions = ["friendship"]
    assert eligible(a, b)


@pytest.mark.parametrize("reverse", [True, False])
def test_block_disqualifies_both_modes_in_both_directions(pair, reverse):
    a, b = pair
    Block.objects.create(blocker=b if reverse else a, blocked=a if reverse else b)
    assert not eligible(a, b)
    assert not eligible(b, a)


@pytest.mark.parametrize("change", ["disabled", "unverified"])
def test_account_safety_filters_never_softened(pair, change):
    a, b = pair
    if change == "disabled":
        b.is_active = False
    elif change == "unverified":
        b.email_verified_at = None
    assert not eligible(a, b)


def test_self_matching_rejected(pair):
    assert not eligible(pair[0], pair[0])


def test_birthday_boundary():
    assert age_on(date(2008, 9, 15), date(2026, 9, 14)) == 17
    assert age_on(date(2008, 9, 14), date(2026, 9, 14)) == 18


def test_block_endpoint_idempotent_and_no_self_block(client, pair):
    a, b = pair
    client.force_login(a)
    payload = {"profile_id": str(b.profile.pk)}
    assert client.post("/api/v1/blocks/", payload).status_code == 204
    assert client.post("/api/v1/blocks/", payload).status_code == 204
    assert Block.objects.count() == 1
    assert client.post("/api/v1/blocks/", {"profile_id": str(a.profile.pk)}).status_code == 400
