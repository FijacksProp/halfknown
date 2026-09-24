from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from .catalog import AVATARS, GENDERS, INTENTIONS, INTERESTS, STYLES, age_on
from .models import MatchPreferences, Profile


RESERVED_USERNAMES = {"admin", "administrator", "halfknown", "moderator", "support"}


class UsernameField(serializers.RegexField):
    def __init__(self, **kwargs):
        super().__init__(
            r"^[a-z][a-z0-9_]{2,23}$",
            max_length=24,
            error_messages={"invalid": "Use 3–24 letters, numbers or underscores, starting with a letter."},
            **kwargs,
        )

    def to_internal_value(self, data):
        if isinstance(data, str):
            data = data.strip().lower()
        value = super().to_internal_value(data)
        if value in RESERVED_USERNAMES:
            raise serializers.ValidationError("This username is reserved.")
        request = self.parent.context.get("request")
        existing = Profile.objects.filter(alias__iexact=value)
        if request and request.user.is_authenticated:
            existing = existing.exclude(user=request.user)
        if existing.exists():
            raise serializers.ValidationError("This username is already taken.")
        return value


class UniqueChoices(serializers.ListField):
    def __init__(self, choices, **kwargs):
        super().__init__(child=serializers.ChoiceField(choices=choices), **kwargs)

    def to_internal_value(self, data):
        values = super().to_internal_value(data)
        if len(values) != len(set(values)):
            raise serializers.ValidationError("Duplicate choices are not allowed.")
        return values


class PreferenceInput(serializers.Serializer):
    genders = UniqueChoices(GENDERS, min_length=1, max_length=len(GENDERS))
    min_age = serializers.IntegerField(min_value=18, max_value=120)
    max_age = serializers.IntegerField(min_value=18, max_value=120)
    open_chat_opt_in = serializers.BooleanField()

    def validate(self, attrs):
        if attrs["max_age"] < attrs["min_age"]:
            raise serializers.ValidationError("Maximum age must be at least minimum age.")
        return attrs


class OnboardingInput(serializers.Serializer):
    username = UsernameField()
    birth_date = serializers.DateField()
    accepted_terms = serializers.BooleanField()
    accepted_guidelines = serializers.BooleanField()
    policy_version = serializers.CharField(max_length=64)
    avatar_id = serializers.ChoiceField(choices=AVATARS, required=False)
    gender = serializers.ChoiceField(choices=GENDERS)
    intentions = UniqueChoices(INTENTIONS, min_length=1, max_length=4)
    interests = UniqueChoices(INTERESTS, min_length=3, max_length=5)
    languages = serializers.ListField(
        child=serializers.RegexField(r"^[a-z]{2,3}(?:-[A-Z]{2})?$"),
        min_length=1,
        max_length=5,
    )
    conversation_style = serializers.ChoiceField(choices=STYLES)
    prompt_answer = serializers.CharField(max_length=280, required=False, allow_blank=True)
    preferences = PreferenceInput()

    def validate_birth_date(self, value):
        age = age_on(value, timezone.localdate())
        if age < 18 or age > 120:
            raise serializers.ValidationError(
                "Halfknown is for adults aged 18 and over. Enter a valid birth date."
            )
        return value

    def validate(self, attrs):
        if not attrs["accepted_terms"] or not attrs["accepted_guidelines"]:
            raise serializers.ValidationError("Accept the terms and community guidelines to continue.")
        if attrs["policy_version"] != settings.POLICY_VERSION:
            raise serializers.ValidationError("Refresh the policy information and try again.")
        return attrs


class ProfileOutput(serializers.ModelSerializer):
    """Owner-only representation. Do not reuse it for match cards."""

    class Meta:
        model = Profile
        fields = [
            "id",
            "alias",
            "avatar_group",
            "avatar_id",
            "gender",
            "intentions",
            "interests",
            "languages",
            "conversation_style",
            "prompt_answer",
            "bio",
            "discoverable",
        ]


class PreferencesOutput(serializers.ModelSerializer):
    class Meta:
        model = MatchPreferences
        fields = ["genders", "min_age", "max_age", "open_chat_opt_in"]
