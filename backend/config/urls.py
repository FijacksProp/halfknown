from django.contrib import admin
from django.http import JsonResponse
from django.urls import path

from apps.accounts.views import CsrfView, LogoutView, MeView, RequestCodeView, VerifyCodeView
from apps.moderation.views import BlockView
from apps.profiles.views import CatalogView, IdentityPreviewView, PreferencesView, ProfileView


def health(request):
    response = JsonResponse({"status": "ok", "service": "halfknown-api"})
    response["Cache-Control"] = "no-store"
    return response


urlpatterns = [
    path("health/", health),
    path("admin/", admin.site.urls),
    path("api/v1/auth/csrf/", CsrfView.as_view()),
    path("api/v1/auth/request-code/", RequestCodeView.as_view()),
    path("api/v1/auth/verify-code/", VerifyCodeView.as_view()),
    path("api/v1/auth/logout/", LogoutView.as_view()),
    path("api/v1/me/", MeView.as_view()),
    path("api/v1/catalog/", CatalogView.as_view()),
    path("api/v1/identity-preview/", IdentityPreviewView.as_view()),
    path("api/v1/profile/", ProfileView.as_view()),
    path("api/v1/preferences/", PreferencesView.as_view()),
    path("api/v1/blocks/", BlockView.as_view()),
]
admin.site.site_header = "Halfknown administration"
admin.site.site_title = "Halfknown"
