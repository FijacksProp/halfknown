import secrets

from django.conf import settings
from django.db import transaction
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.matching.services import leave, match_lock

from .catalog import AVATARS, GENDERS, INTENTIONS, INTERESTS, STYLES
from .models import MatchPreferences, PrivateProfile, Profile, new_alias
from .serializers import OnboardingInput, PreferenceInput, PreferencesOutput, ProfileOutput


class CatalogView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {
                "genders": GENDERS,
                "intentions": INTENTIONS,
                "interests": INTERESTS,
                "avatars": AVATARS,
                "styles": STYLES,
                "policy_version": settings.POLICY_VERSION,
                "policies": {"terms": settings.TERMS_URL, "privacy": settings.PRIVACY_URL,
                             "guidelines": settings.GUIDELINES_URL},
            }
        )


class IdentityPreviewView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"alias": new_alias(), "avatar_id": secrets.choice(AVATARS)})


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
        data = OnboardingInput(data=request.data)
        data.is_valid(raise_exception=True)
        values = dict(data.validated_data)
        preferences = values.pop("preferences")
        birth_date = values.pop("birth_date")
        policy_version = values.pop("policy_version")
        values.pop("accepted_terms")
        values.pop("accepted_guidelines")
        with match_lock(), transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk)
            if create_only and Profile.objects.filter(user=user).exists():
                return Response({"detail": "Your profile already exists. Reload it to continue."}, status=409)
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
            prefs, _ = MatchPreferences.objects.update_or_create(user=request.user, defaults=data.validated_data)
        return Response(PreferencesOutput(prefs).data)
