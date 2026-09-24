import secrets
import uuid

from django.conf import settings
from django.contrib.auth import login
from django.db import transaction
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.matching.services import leave, match_lock

from .catalog import (
    AVATAR_GROUPS,
    AVATARS,
    GENDERS,
    INTENTIONS,
    INTERESTS,
    STYLES,
    assign_avatar,
    avatar_choices,
)
from .models import MatchPreferences, PrivateProfile, Profile, new_alias
from .serializers import OnboardingInput, PreferenceInput, PreferencesOutput, ProfileOutput, UsernameField


class RandomAccessInput(serializers.Serializer):
    username = UsernameField()
    gender = serializers.ChoiceField(choices=GENDERS)
    adult_confirmed = serializers.BooleanField()
    accepted_terms = serializers.BooleanField()
    accepted_guidelines = serializers.BooleanField()
    policy_version = serializers.CharField(max_length=64)
    interests = serializers.ListField(
        child=serializers.ChoiceField(choices=INTERESTS), required=False, max_length=5
    )
    discoverable = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        if not attrs["adult_confirmed"]:
            raise serializers.ValidationError("Halfknown is only for adults aged 18 and over.")
        if not attrs["accepted_terms"] or not attrs["accepted_guidelines"]:
            raise serializers.ValidationError("Accept the terms and community guidelines to continue.")
        if attrs["policy_version"] != settings.POLICY_VERSION:
            raise serializers.ValidationError("Refresh the policy information and try again.")
        if len(attrs.get("interests", [])) != len(set(attrs.get("interests", []))):
            raise serializers.ValidationError({"interests": "Choose each interest once."})
        return attrs


@method_decorator(csrf_protect, name="dispatch")
class RandomAccessView(APIView):
    """Create or prepare a session-owned anonymous identity in one short step."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "random_access"

    def post(self, request):
        data = RandomAccessInput(data=request.data, context={"request": request})
        data.is_valid(raise_exception=True)
        values = data.validated_data
        now = timezone.now()
        with transaction.atomic():
            user = (
                request.user
                if request.user.is_authenticated
                else User.objects.create_user(
                    email=f"guest-{uuid.uuid4().hex}@guest.halfknown.invalid",
                    password=None,
                    email_verified_at=now,
                )
            )
            PrivateProfile.objects.update_or_create(
                user=user,
                defaults={
                    "adult_confirmed_at": now,
                    "policy_version": values["policy_version"],
                },
            )
            group, avatar_id = assign_avatar(values["gender"])
            profile, created = Profile.objects.get_or_create(
                user=user,
                defaults={
                    "alias": values["username"],
                    "avatar_group": group,
                    "avatar_id": avatar_id,
                    "gender": values["gender"],
                    "intentions": ["conversation"],
                    "interests": values.get("interests", []),
                    "languages": ["en"],
                    "conversation_style": "lighthearted",
                    "discoverable": values["discoverable"],
                },
            )
            profile.gender = values["gender"]
            profile.alias = values["username"]
            if not created:
                group = profile.avatar_group or profile.avatar_id.split("-")[0]
                if group not in AVATAR_GROUPS:
                    group, avatar_id = assign_avatar(values["gender"])
                elif profile.avatar_id in avatar_choices(group, values["gender"]):
                    avatar_id = profile.avatar_id
                else:
                    avatar_id = secrets.choice(avatar_choices(group, values["gender"]))
                profile.avatar_group = group
                profile.avatar_id = avatar_id
            if "interests" in values:
                profile.interests = values["interests"]
            # Existing anonymous profiles remain private until the owner opts in.
            if values["discoverable"]:
                profile.discoverable = True
            profile.save(
                update_fields=[
                    "gender",
                    "alias",
                    "avatar_group",
                    "avatar_id",
                    "interests",
                    "discoverable",
                    "updated_at",
                ]
            )
            preferences, _ = MatchPreferences.objects.get_or_create(
                user=user,
                defaults={
                    "genders": list(GENDERS),
                    "min_age": 18,
                    "max_age": 120,
                    "open_chat_opt_in": True,
                },
            )
        if not request.user.is_authenticated:
            login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        return Response(
            {
                "account": {
                    "id": str(user.pk),
                    "email": "" if user.email.endswith("@guest.halfknown.invalid") else user.email,
                    "email_verified": True,
                    "onboarding_complete": True,
                    "is_guest": user.email.endswith("@guest.halfknown.invalid"),
                },
                "profile": ProfileOutput(profile).data,
                "preferences": PreferencesOutput(preferences).data,
                "csrf_token": get_token(request),
            },
            status=201,
        )


class CatalogView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {
                "genders": GENDERS,
                "intentions": INTENTIONS,
                "interests": INTERESTS,
                "avatars": AVATARS,
                "avatar_groups": AVATAR_GROUPS,
                "styles": STYLES,
                "policy_version": settings.POLICY_VERSION,
                "policies": {
                    "terms": settings.TERMS_URL,
                    "privacy": settings.PRIVACY_URL,
                    "guidelines": settings.GUIDELINES_URL,
                },
            }
        )


class IdentityPreviewView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"alias": new_alias(), "avatar_id": assign_avatar("undisclosed")[1]})


class ProfileView(APIView):
    def get(self, request):
        profile = Profile.objects.filter(user=request.user).first()
        if not profile:
            return Response({"detail": "Complete onboarding first."}, status=404)
        return Response(
            {
                "profile": ProfileOutput(profile).data,
                "preferences": PreferencesOutput(request.user.preferences).data,
            }
        )

    def put(self, request):
        return self.save_profile(request, create_only=False)

    def post(self, request):
        return self.save_profile(request, create_only=True)

    def save_profile(self, request, *, create_only):
        data = OnboardingInput(data=request.data, context={"request": request})
        data.is_valid(raise_exception=True)
        values = dict(data.validated_data)
        values["alias"] = values.pop("username")
        requested_avatar = values.pop("avatar_id", None)
        preferences = values.pop("preferences")
        birth_date = values.pop("birth_date")
        policy_version = values.pop("policy_version")
        values.pop("accepted_terms")
        values.pop("accepted_guidelines")
        with match_lock(), transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk)
            if create_only and Profile.objects.filter(user=user).exists():
                return Response({"detail": "Your profile already exists. Reload it to continue."}, status=409)
            existing = Profile.objects.filter(user=user).first()
            if existing:
                group = existing.avatar_group or existing.avatar_id.split("-")[0]
                choices = avatar_choices(group, values["gender"])
                if requested_avatar and requested_avatar not in choices:
                    raise ValidationError(
                        {"avatar_id": "Choose a portrait from your assigned creature group."}
                    )
                avatar_id = requested_avatar or existing.avatar_id
                if not choices:
                    group, avatar_id = assign_avatar(values["gender"])
                elif avatar_id not in choices:
                    avatar_id = secrets.choice(choices)
            else:
                group, avatar_id = assign_avatar(values["gender"])
            values["avatar_group"] = group
            values["avatar_id"] = avatar_id
            private = PrivateProfile.objects.filter(user=user).first()
            if private and private.birth_date != birth_date:
                raise ValidationError({"birth_date": "Contact support to correct your birth date."})
            leave(user)
            PrivateProfile.objects.get_or_create(
                user=user,
                defaults={
                    "birth_date": birth_date,
                    "policy_version": policy_version,
                },
            )
            profile, created = Profile.objects.update_or_create(user=user, defaults=values)
            prefs, _ = MatchPreferences.objects.update_or_create(user=user, defaults=preferences)
        return Response(
            {"profile": ProfileOutput(profile).data, "preferences": PreferencesOutput(prefs).data},
            status=201 if created else 200,
        )


class PreferencesView(APIView):
    def put(self, request):
        if not Profile.objects.filter(user=request.user).exists():
            return Response({"detail": "Complete onboarding first."}, status=409)
        data = PreferenceInput(data=request.data)
        data.is_valid(raise_exception=True)
        with match_lock():
            leave(request.user)
            prefs, _ = MatchPreferences.objects.update_or_create(
                user=request.user, defaults=data.validated_data
            )
        return Response(PreferencesOutput(prefs).data)
