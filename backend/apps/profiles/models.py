import secrets
import uuid

from django.conf import settings
from django.db import models


def new_alias():
    first = secrets.choice(("Quiet", "Bright", "Curious", "Velvet", "Cosmic", "Mellow"))
    second = secrets.choice(("Comet", "Otter", "Orbit", "Finch", "Moon", "Echo"))
    return f"{first}{second}-{secrets.token_hex(4)}"


class PrivateProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="private_profile"
    )
    birth_date = models.DateField(null=True, blank=True)
    adult_confirmed_at = models.DateTimeField(null=True, blank=True)
    policy_version = models.CharField(max_length=64)
    accepted_at = models.DateTimeField(auto_now_add=True)


class Profile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    alias = models.CharField(max_length=64, unique=True, default=new_alias, editable=False)
    avatar_group = models.CharField(max_length=16, default="", editable=False)
    avatar_id = models.CharField(max_length=32)
    gender = models.CharField(max_length=24)
    intentions = models.JSONField(default=list)
    interests = models.JSONField(default=list)
    languages = models.JSONField(default=list)
    conversation_style = models.CharField(max_length=24)
    prompt_answer = models.CharField(max_length=280, blank=True)
    bio = models.CharField(max_length=300, blank=True)
    discoverable = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)


class MatchPreferences(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="preferences"
    )
    genders = models.JSONField(default=list)
    min_age = models.PositiveSmallIntegerField(default=18)
    max_age = models.PositiveSmallIntegerField(default=120)
    open_chat_opt_in = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(min_age__gte=18), name="matching_adults_only"),
            models.CheckConstraint(condition=models.Q(max_age__lte=120), name="matching_age_upper_bound"),
            models.CheckConstraint(
                condition=models.Q(max_age__gte=models.F("min_age")), name="matching_age_order"
            ),
        ]
