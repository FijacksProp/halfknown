import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier

import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.conf import settings
from django.db import close_old_connections, connection
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.matching.models import Conversation, MatchGate, MatchSlot, Message
from apps.matching.services import join
from apps.moderation.models import Block, Report
from config.asgi import application

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def people(profile_payload):
    result = []
    for index in range(3):
        user = User.objects.create_user(f"chat-{index}@example.com", email_verified_at=timezone.now())
        client = APIClient()
        client.force_login(user)
        payload = {
            **profile_payload,
            "gender": "woman" if index == 1 else "man",
            "preferences": {
                **profile_payload["preferences"],
                "genders": ["woman", "man"],
                "open_chat_opt_in": True,
            },
        }
        assert client.post("/api/v1/profile/", payload, format="json").status_code == 201
        result.append((user, client))
    return result


def queue(client):
    return client.post("/api/v1/matching/queue/", {}, format="json")


def heartbeat(client):
    return client.post("/api/v1/matching/heartbeat/", {}, format="json")


def pair(people):
    assert queue(people[0][1]).data["state"] == "waiting"
    response = queue(people[1][1])
    assert response.status_code == 200
    assert response.data["state"] == "active"
    return response.data["id"]


def send(client, chat_id, body="Hello", client_id=None):
    return client.post(
        f"/api/v1/chats/{chat_id}/messages/",
        {"body": body, "client_id": str(client_id or uuid.uuid4())},
        format="json",
    )


def test_random_pair_is_instant_and_private(people):
    chat_id = pair(people)
    snapshot = heartbeat(people[0][1]).data
    assert snapshot["id"] == chat_id
    assert snapshot["state"] == "active"
    assert snapshot["mode"] == "random"
    assert snapshot["intention"] == "conversation"
    assert set(snapshot["peer"]) == {"alias", "avatar_id", "shared_interests"}
    assert snapshot["peer"]["shared_interests"] == []
    assert "email" not in str(snapshot) and "birth_date" not in str(snapshot)
    assert send(people[0][1], chat_id).status_code == 201


def test_quick_meet_can_become_a_mutual_connection(people):
    chat_id = pair(people)
    path = f"/api/v1/chats/{chat_id}/connect/"
    first = people[0][1].post(path)
    assert first.status_code == 201
    assert first.data["status"] == "pending"
    second = people[1][1].post(path)
    assert second.status_code == 200
    assert second.data["status"] == "accepted"
    assert first.data["id"] == second.data["id"]
    messages = f"/api/v1/social/connections/{first.data['id']}/messages/"
    assert people[0][1].post(messages, {"body": "Let's keep talking"}).status_code == 201


def test_quick_connection_request_is_visible_and_can_be_declined(people):
    chat_id = pair(people)
    path = f"/api/v1/chats/{chat_id}/connect/"
    assert people[1][1].get(path).data == {"connection": None}
    request = people[0][1].post(path)
    assert request.data["direction"] == "outgoing"
    incoming = people[1][1].get(path).data["connection"]
    assert incoming["id"] == request.data["id"]
    assert incoming["status"] == "pending"
    assert incoming["direction"] == "incoming"
    assert people[0][1].delete(path).status_code == 404
    assert people[2][1].get(path).status_code == 404
    assert people[1][1].delete(path).status_code == 204
    assert people[0][1].get(path).data["connection"]["status"] == "declined"
    assert people[0][1].post(path).data["status"] == "declined"
    assert people[0][1].get("/api/v1/social/connections/").data["results"] == []
    assert people[1][1].get(path).data == {"connection": None}

    renewed = people[1][1].post(path)
    assert renewed.data["status"] == "pending"
    assert people[0][1].get(path).data["connection"]["direction"] == "incoming"
    accepted = people[0][1].post(path)
    assert accepted.data["status"] == "accepted"
    assert people[1][1].get(path).data["connection"]["status"] == "accepted"


def test_queue_is_idempotent_and_does_not_double_book(people):
    chat_id = pair(people)
    assert queue(people[0][1]).data["id"] == chat_id
    assert queue(people[2][1]).data["state"] == "waiting"
    assert Conversation.objects.count() == 1
    assert MatchSlot.objects.count() == 3


def test_next_requeues_both_people_and_avoids_immediate_repeat(people):
    chat_id = pair(people)
    assert queue(people[2][1]).data["state"] == "waiting"
    result = people[0][1].post(f"/api/v1/chats/{chat_id}/next/")
    assert result.status_code == 200
    assert result.data["state"] == "active"
    assert result.data["peer"]["alias"] == people[2][0].profile.alias
    assert heartbeat(people[1][1]).data["state"] == "waiting"
    assert Conversation.objects.get(pk=chat_id).end_reason == "next"
    # A delayed duplicate cannot end the newer conversation.
    assert people[0][1].post(f"/api/v1/chats/{chat_id}/next/").data["id"] == result.data["id"]


def test_leave_stops_leaver_and_requeues_person_left_behind(people):
    chat_id = pair(people)
    assert queue(people[2][1]).data["state"] == "waiting"
    assert people[0][1].delete("/api/v1/matching/queue/").status_code == 204
    assert heartbeat(people[0][1]).data["state"] == "idle"
    peer = heartbeat(people[1][1]).data
    assert peer["state"] == "active"
    assert peer["peer"]["alias"] == people[2][0].profile.alias
    assert send(people[1][1], chat_id).status_code == 400


def test_absent_session_is_not_requeued_but_present_peer_is(people):
    pair(people)
    assert queue(people[2][1]).data["state"] == "waiting"
    MatchSlot.objects.filter(user=people[0][0]).update(expires_at=timezone.now() - timedelta(seconds=1))
    result = heartbeat(people[1][1]).data
    assert result["state"] == "active"
    assert result["peer"]["alias"] == people[2][0].profile.alias
    assert not MatchSlot.objects.filter(user=people[0][0]).exists()


def test_recent_pair_can_match_again_after_cooldown(people):
    chat_id = pair(people)
    people[0][1].post(f"/api/v1/chats/{chat_id}/next/")
    people[0][1].delete("/api/v1/matching/queue/")
    people[1][1].delete("/api/v1/matching/queue/")
    Conversation.objects.update(ended_at=timezone.now() - timedelta(minutes=11))
    assert queue(people[0][1]).data["state"] == "waiting"
    assert queue(people[1][1]).data["state"] == "active"


def test_next_requires_membership_and_active_chat(people):
    chat_id = pair(people)
    outsider = people[2][1]
    assert outsider.post(f"/api/v1/chats/{chat_id}/next/").status_code == 404
    people[0][1].delete("/api/v1/matching/queue/")
    assert people[0][1].post(f"/api/v1/chats/{chat_id}/next/").data["state"] == "idle"


def test_message_retries_cursor_and_outsider_denial(people):
    chat_id = pair(people)
    a, b, outsider = [person[1] for person in people]
    token = uuid.uuid4()
    first = send(a, chat_id, "<script>not HTML</script>", token)
    assert first.status_code == 201
    assert send(a, chat_id, "<script>not HTML</script>", token).data == first.data
    assert send(a, chat_id, "different", token).status_code == 400
    assert Message.objects.count() == 1
    received = b.get(f"/api/v1/chats/{chat_id}/messages/").data
    assert received["messages"][0]["mine"] is False
    assert received["messages"][0]["body"] == "<script>not HTML</script>"
    assert b.get(f"/api/v1/chats/{chat_id}/messages/?after={first.data['id']}").data["messages"] == []
    assert b.get(f"/api/v1/chats/{chat_id}/messages/?after=-1").status_code == 400
    for suffix in ["messages/", "typing/", "block/", "report/"]:
        assert (
            outsider.post(
                f"/api/v1/chats/{chat_id}/{suffix}",
                {"client_id": str(uuid.uuid4()), "body": "stolen", "reason": "spam"},
                format="json",
            ).status_code
            == 404
        )
    assert outsider.get(f"/api/v1/chats/{chat_id}/messages/").status_code == 404


@pytest.mark.parametrize("body", ["", "   ", "x" * 2001])
def test_message_validation(people, body):
    assert send(people[0][1], pair(people), body).status_code == 400


def test_message_rate_limit(people):
    chat_id = pair(people)
    for _ in range(10):
        assert send(people[0][1], chat_id).status_code == 201
    assert send(people[0][1], chat_id).status_code == 429


def test_queue_requires_a_verified_adult_identity(people, user):
    client = APIClient()
    client.force_login(user)
    assert queue(client).status_code == 400
    people[0][0].email_verified_at = None
    people[0][0].save()
    assert queue(people[0][1]).status_code == 403


def test_gender_age_language_and_intention_do_not_filter_random_queue(people):
    first, second = people[0][0], people[1][0]
    second.preferences.genders = []
    second.preferences.min_age = 100
    second.preferences.max_age = 120
    second.preferences.open_chat_opt_in = False
    second.preferences.save()
    second.profile.languages = ["fr"]
    second.profile.intentions = ["friendship"]
    second.profile.save()
    assert queue(people[0][1]).data["state"] == "waiting"
    assert queue(people[1][1]).data["state"] == "active"
    conversation = Conversation.objects.get()
    assert {conversation.first_id, conversation.second_id} == {first.pk, second.pk}


def test_block_prevents_pairing_and_requeues_peer(people):
    chat_id = pair(people)
    assert queue(people[2][1]).data["state"] == "waiting"
    response = people[0][1].post(f"/api/v1/chats/{chat_id}/block/")
    assert response.status_code == 204
    assert Block.objects.filter(blocker=people[0][0], blocked=people[1][0]).exists()
    assert heartbeat(people[0][1]).data["state"] == "idle"
    assert heartbeat(people[1][1]).data["state"] == "active"


def test_report_captures_evidence_and_blocks(people):
    chat_id = pair(people)
    send(people[0][1], chat_id, "Evidence")
    for _ in range(2):
        assert (
            people[0][1]
            .post(
                f"/api/v1/chats/{chat_id}/report/",
                {"reason": "harassment", "details": "Please review."},
                format="json",
            )
            .status_code
            == 204
        )
    assert Report.objects.count() == 1
    assert Report.objects.get().evidence[0]["body"] == "Evidence"
    assert Block.objects.filter(blocker=people[0][0], blocked=people[1][0]).exists()


def test_csrf_and_anonymous_access(people):
    assert APIClient().post("/api/v1/matching/heartbeat/").status_code == 403
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(people[0][0])
    assert queue(client).status_code == 403
    token = client.get("/api/v1/auth/csrf/").data["csrf_token"]
    client.credentials(HTTP_X_CSRFTOKEN=token)
    assert queue(client).status_code == 200


def test_concurrent_queue_reservations(people):
    if connection.vendor != "postgresql":
        pytest.skip("Requires PostgreSQL integration service.")
    MatchGate.objects.get_or_create(pk=1)
    barrier = Barrier(3)

    def attempt(uid):
        close_old_connections()
        try:
            user = User.objects.get(pk=uid)
            barrier.wait(timeout=10)
            return join(user)
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(attempt, [person[0].pk for person in people]))
    assert Conversation.objects.count() == 1
    assert MatchSlot.objects.exclude(conversation=None).count() == 2


@pytest.mark.asyncio
async def test_two_sessions_receive_chat_events_and_recover_messages(people):
    def make_socket(client):
        key = client.cookies[settings.SESSION_COOKIE_NAME].value
        return WebsocketCommunicator(
            application,
            "/ws/events/",
            headers=[
                (b"origin", b"http://localhost:8000"),
                (b"cookie", f"{settings.SESSION_COOKIE_NAME}={key}".encode()),
            ],
        )

    a, b = people[0][1], people[1][1]
    chat_id = await database_sync_to_async(pair)(people)
    sockets = [make_socket(a), make_socket(b)]
    try:
        for socket in sockets:
            assert (await socket.connect())[0]
            assert (await socket.receive_json_from())["type"] == "connection.ready"
        sent = await database_sync_to_async(send)(a, chat_id, "Hello through the live flow")
        for socket in sockets:
            assert await socket.receive_json_from() == {
                "type": "chat.changed",
                "conversation_id": chat_id,
            }
        received = await database_sync_to_async(b.get)(f"/api/v1/chats/{chat_id}/messages/")
        assert received.data["messages"][0]["id"] == sent.data["id"]
        await database_sync_to_async(a.post)(f"/api/v1/chats/{chat_id}/typing/")
        assert (await sockets[1].receive_json_from())["type"] == "chat.typing"
    finally:
        for socket in sockets:
            await socket.disconnect()
