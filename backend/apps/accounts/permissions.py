from rest_framework.permissions import BasePermission


class VerifiedUser(BasePermission):
    message = "Sign in with a verified email to continue."

    def has_permission(self, request, view):
        user = request.user
        return bool(user.is_authenticated and user.is_active and user.email_verified_at)
