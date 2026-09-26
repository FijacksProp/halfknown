from django.contrib import admin
from django.http import JsonResponse
from django.urls import path

from apps.accounts.views import CsrfView, LogoutView, MeView, RequestCodeView, VerifyCodeView
from apps.matching.views import AcceptView, HeartbeatView, MessagesView, NextPersonView, QueueView, TypingView
from apps.moderation.views import BlockView, ChatSafetyView
from apps.profiles.views import (
    CatalogView,
    IdentityPreviewView,
    PreferencesView,
    ProfileView,
    RandomAccessView,
)
from apps.social.views import (
    ConnectionAcceptView,
    ConnectionsView,
    ConnectionView,
    DiscoverView,
    FollowView,
    PublicProfileView,
    ProfilePhotoView,
    QuickConnectionView,
    SelfView,
    SelfPhotoView,
    ShowcaseDeleteView,
    ShowcaseView,
    SocialSafetyView,
)
from apps.social.views import (
    MessagesView as SocialMessagesView,
)
from config.health import ready


def health(request):
    response = JsonResponse({"status": "ok", "service": "halfknown-api"})
    response["Cache-Control"] = "no-store"
    return response


urlpatterns = [
    path("health/", health),
    path("health/ready/", ready),
    path("admin/", admin.site.urls),
    path("api/v1/auth/csrf/", CsrfView.as_view()),
    path("api/v1/auth/request-code/", RequestCodeView.as_view()),
    path("api/v1/auth/verify-code/", VerifyCodeView.as_view()),
    path("api/v1/auth/logout/", LogoutView.as_view()),
    path("api/v1/me/", MeView.as_view()),
    path("api/v1/catalog/", CatalogView.as_view()),
    path("api/v1/identity-preview/", IdentityPreviewView.as_view()),
    path("api/v1/random-access/", RandomAccessView.as_view()),
    path("api/v1/profile/", ProfileView.as_view()),
    path("api/v1/preferences/", PreferencesView.as_view()),
    path("api/v1/social/me/", SelfView.as_view()),
    path("api/v1/social/me/photo/", SelfPhotoView.as_view()),
    path("api/v1/social/discover/", DiscoverView.as_view()),
    path("api/v1/social/connections/", ConnectionsView.as_view()),
    path("api/v1/social/connections/<uuid:connection_id>/accept/", ConnectionAcceptView.as_view()),
    path("api/v1/social/connections/<uuid:connection_id>/messages/", SocialMessagesView.as_view()),
    path("api/v1/social/showcase/", ShowcaseView.as_view()),
    path("api/v1/social/showcase/<uuid:item_id>/", ShowcaseDeleteView.as_view()),
    path("api/v1/social/profiles/<uuid:profile_id>/", PublicProfileView.as_view()),
    path("api/v1/social/profiles/<uuid:profile_id>/photo/", ProfilePhotoView.as_view()),
    path("api/v1/social/profiles/<uuid:profile_id>/follow/", FollowView.as_view()),
    path("api/v1/social/profiles/<uuid:profile_id>/connect/", ConnectionView.as_view()),
    path("api/v1/social/profiles/<uuid:profile_id>/block/", SocialSafetyView.as_view(), {"action": "block"}),
    path(
        "api/v1/social/profiles/<uuid:profile_id>/report/", SocialSafetyView.as_view(), {"action": "report"}
    ),
    path("api/v1/blocks/", BlockView.as_view()),
    path("api/v1/matching/queue/", QueueView.as_view()),
    path("api/v1/matching/heartbeat/", HeartbeatView.as_view()),
    path("api/v1/chats/<uuid:chat_id>/accept/", AcceptView.as_view()),
    path("api/v1/chats/<uuid:chat_id>/decline/", NextPersonView.as_view(), {"decline": True}),
    path("api/v1/chats/<uuid:chat_id>/next/", NextPersonView.as_view()),
    path("api/v1/chats/<uuid:chat_id>/messages/", MessagesView.as_view()),
    path("api/v1/chats/<uuid:chat_id>/connect/", QuickConnectionView.as_view()),
    path("api/v1/chats/<uuid:chat_id>/typing/", TypingView.as_view()),
    path("api/v1/chats/<uuid:chat_id>/block/", ChatSafetyView.as_view(), {"action": "block"}),
    path("api/v1/chats/<uuid:chat_id>/report/", ChatSafetyView.as_view(), {"action": "report"}),
]
admin.site.site_header = "Halfknown administration"
admin.site.site_title = "Halfknown"
