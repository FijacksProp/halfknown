from django.contrib.auth import login, logout
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.debug import sensitive_post_parameters
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .services import request_code, verify_code


class CsrfView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"csrf_token": get_token(request)})


class EmailInput(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


class VerifyInput(serializers.Serializer):
    challenge_id = serializers.UUIDField()
    code = serializers.RegexField(r"^\d{6}$", trim_whitespace=True)


@method_decorator(sensitive_post_parameters("email"), name="dispatch")
class RequestCodeView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_request"

    def post(self, request):
        data = EmailInput(data=request.data)
        data.is_valid(raise_exception=True)
        try:
            challenge_id = request_code(
                data.validated_data["email"],
                guest_user=request.user if request.user.is_authenticated else None,
            )
        except ValueError as error:
            raise serializers.ValidationError({"email": str(error)}) from error
        return Response(
            {
                "challenge_id": str(challenge_id),
                "detail": "If this account can sign in, a code has been sent. Recent requests may be rate-limited.",
            },
            status=status.HTTP_202_ACCEPTED,
        )


@method_decorator(sensitive_post_parameters("code"), name="dispatch")
class VerifyCodeView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_verify"

    def post(self, request):
        data = VerifyInput(data=request.data)
        data.is_valid(raise_exception=True)
        user = verify_code(**data.validated_data)
        if not user:
            return Response({"detail": "Invalid or expired code."}, status=400)
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        return Response({"id": str(user.pk), "email_verified": True, "csrf_token": get_token(request)})


class MeView(APIView):
    def get(self, request):
        guest = request.user.email.endswith("@guest.halfknown.invalid")
        return Response(
            {
                "id": str(request.user.pk),
                "email": "" if guest else request.user.email,
                "email_verified": bool(request.user.email_verified_at),
                "onboarding_complete": hasattr(request.user, "profile"),
                "is_guest": guest,
            }
        )


class LogoutView(APIView):
    def post(self, request):
        from apps.matching.services import leave

        leave(request.user)
        logout(request)
        return Response(status=204)
