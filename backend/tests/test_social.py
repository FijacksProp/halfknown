import re
from unittest.mock import patch

import pytest
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.profiles.models import Profile
from apps.social.models import Connection, DirectMessage

pytestmark = pytest.mark.django_db


def create_profile(user, **values):
    return Profile.objects.create(
        user=user,
        avatar_id=values.pop("avatar_id", "alien-01"),
        gender=values.pop("gender", "undisclosed"),
        intentions=["friendship"],
        interests=["music"],
        languages=["en"],
        conversation_style="playful",
        **values,
    )


def test_discovery_connection_messages_and_block(signed_in, user):
    create_profile(user, discoverable=True)
    peer = User.objects.create_user("peer@example.com", email_verified_at=timezone.now())
    peer_profile = create_profile(peer)
    peer_client = APIClient()
    peer_client.force_login(peer)

    assert signed_in.get("/api/v1/social/discover/").data["results"] == []
    assert peer_client.patch("/api/v1/social/me/", {"discoverable": True}).status_code == 200
    result = signed_in.get("/api/v1/social/discover/?interest=music").data["results"]
    assert [person["id"] for person in result] == [str(peer_profile.pk)]

    path = f"/api/v1/social/profiles/{peer_profile.pk}/"
    assert signed_in.post(path + "follow/").data["following"] is True
    request = signed_in.post(path + "connect/")
    assert request.status_code == 201
    connection_id = request.data["id"]
    messages_path = f"/api/v1/social/connections/{connection_id}/messages/"
    assert signed_in.post(messages_path, {"body": "Too early"}).status_code == 404
    assert peer_client.post(f"/api/v1/social/connections/{connection_id}/accept/").status_code == 200
    assert signed_in.post(messages_path, {"body": "Hello there"}).status_code == 201
    assert peer_client.get(messages_path).data["results"][0]["body"] == "Hello there"
    assert peer_client.post(messages_path, {"body": "Hi!"}).status_code == 201
    assert signed_in.get("/api/v1/social/connections/").data["results"][0]["unread_count"] == 1
    assert signed_in.get(messages_path).data["results"][1]["body"] == "Hi!"
    assert signed_in.get("/api/v1/social/connections/").data["results"][0]["unread_count"] == 0
    assert signed_in.post(path + "block/").status_code == 204
    assert signed_in.get(path).status_code == 404
    assert peer_client.get(messages_path).status_code == 404


def test_unread_count_uses_last_reply_for_existing_conversations(signed_in, user):
    create_profile(user)
    peer = User.objects.create_user("old-thread-peer@example.com", email_verified_at=timezone.now())
    create_profile(peer)
    connection = Connection.objects.create(
        first=user, second=peer, requested_by=user, status="accepted"
    )
    DirectMessage.objects.create(connection=connection, sender=peer, body="Earlier message")
    DirectMessage.objects.create(connection=connection, sender=user, body="My reply")
    latest = DirectMessage.objects.create(connection=connection, sender=peer, body="New message")
    connections_path = "/api/v1/social/connections/"
    messages_path = f"/api/v1/social/connections/{connection.pk}/messages/"

    assert signed_in.get(connections_path).data["results"][0]["unread_count"] == 1
    assert signed_in.get(messages_path).status_code == 200
    connection.refresh_from_db()
    assert connection.first_read_at == latest.created_at
    assert signed_in.get(connections_path).data["results"][0]["unread_count"] == 0

    DirectMessage.objects.create(connection=connection, sender=peer, body="Another new message")
    assert signed_in.get(connections_path).data["results"][0]["unread_count"] == 1


def test_inbox_orders_by_latest_message_and_previews_only_participant_messages(signed_in, user):
    create_profile(user)
    older_peer = User.objects.create_user("older@example.com", email_verified_at=timezone.now())
    newer_peer = User.objects.create_user("newer@example.com", email_verified_at=timezone.now())
    create_profile(older_peer)
    create_profile(newer_peer)
    older = Connection.objects.create(first=user, second=older_peer, requested_by=user, status="accepted")
    newer = Connection.objects.create(first=user, second=newer_peer, requested_by=user, status="accepted")
    DirectMessage.objects.create(connection=newer, sender=user, body="My earlier note")
    DirectMessage.objects.create(connection=older, sender=older_peer, body="Latest hello")

    rows = signed_in.get("/api/v1/social/connections/").data["results"]
    assert [row["id"] for row in rows] == [str(older.pk), str(newer.pk)]
    assert rows[0]["last_message"]["body"] == "Latest hello"
    assert rows[0]["last_message"]["mine"] is False
    assert rows[0]["unread_count"] == 1
    assert rows[1]["last_message"]["mine"] is True


def test_inbox_changes_emit_private_body_free_events(signed_in, user):
    create_profile(user)
    peer = User.objects.create_user("event-peer@example.com", email_verified_at=timezone.now())
    peer_profile = create_profile(peer, discoverable=True)
    peer_client = APIClient()
    peer_client.force_login(peer)

    with patch("apps.social.views.notify") as publish:
        request = signed_in.post(f"/api/v1/social/profiles/{peer_profile.pk}/connect/")
        assert request.status_code == 201
        assert publish.call_args.args[1]["type"] == "social.connection.changed"
        connection_id = request.data["id"]
        assert peer_client.post(f"/api/v1/social/connections/{connection_id}/accept/").status_code == 200
        assert publish.call_args.args[1]["type"] == "social.connection.changed"
        assert signed_in.post(
            f"/api/v1/social/connections/{connection_id}/messages/", {"body": "Private hello"}
        ).status_code == 201
        event = publish.call_args.args[1]
        assert event == {"type": "social.message.changed", "connection_id": connection_id}
        assert "Private hello" not in str(event)


def test_showcase_and_private_profile(signed_in, user):
    profile = create_profile(user)
    item = signed_in.post(
        "/api/v1/social/showcase/", {"kind": "talent", "title": "Music", "description": "I play jazz piano."}
    )
    assert item.status_code == 201
    assert signed_in.get("/api/v1/social/me/").data["showcase"][0]["title"] == "Music"
    viewer = User.objects.create_user("viewer@example.com", email_verified_at=timezone.now())
    create_profile(viewer, discoverable=True)
    viewer_client = APIClient()
    viewer_client.force_login(viewer)
    assert viewer_client.get(f"/api/v1/social/profiles/{profile.pk}/").status_code == 404
    assert signed_in.delete(f"/api/v1/social/showcase/{item.data['id']}/").status_code == 204


def test_guest_can_claim_email_without_losing_profile(client, settings, django_capture_on_commit_callbacks):
    payload = {
        "gender": "undisclosed",
        "discoverable": True,
        "adult_confirmed": True,
        "accepted_terms": True,
        "accepted_guidelines": True,
        "policy_version": settings.POLICY_VERSION,
    }
    joined = client.post("/api/v1/random-access/", payload)
    assert joined.status_code == 201
    assert joined.data["account"]["is_guest"] is True
    profile_id = joined.data["profile"]["id"]
    with django_capture_on_commit_callbacks(execute=True):
        requested = client.post("/api/v1/auth/request-code/", {"email": "claimed@example.com"})
    assert requested.status_code == 202
    code = re.search(r"\b\d{6}\b", mail.outbox[-1].body).group()
    verified = client.post(
        "/api/v1/auth/verify-code/",
        {
            "challenge_id": requested.data["challenge_id"],
            "code": code,
        },
    )
    assert verified.status_code == 200
    assert client.get("/api/v1/me/").data["is_guest"] is False
    assert client.get("/api/v1/profile/").data["profile"]["id"] == profile_id
