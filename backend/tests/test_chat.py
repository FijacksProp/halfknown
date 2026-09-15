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


def queue(client, mode="compatible", intention="dating"):
    return client.post("/api/v1/matching/queue/", {"mode": mode, "intention": intention}, format="json")


def heartbeat(client):
    return client.post("/api/v1/matching/heartbeat/", {}, format="json")


def pair(people, active=True):
    a, b = people[0][1], people[1][1]
    assert queue(a).data["state"] == "waiting"
    response = queue(b)
    assert response.status_code == 200
    chat_id = response.data["id"]
    if active:
        assert a.post(f"/api/v1/chats/{chat_id}/accept/").data["state"] == "invited"
        assert b.post(f"/api/v1/chats/{chat_id}/accept/").data["state"] == "active"
    return chat_id


def send(client, chat_id, body="Hello", client_id=None):
    return client.post(
        f"/api/v1/chats/{chat_id}/messages/",
        {"body": body, "client_id": str(client_id or uuid.uuid4())},
        format="json",
    )


def test_two_party_acceptance_and_private_output(people):
    chat_id = pair(people, active=False)
    a, b = people[0][1], people[1][1]
    assert send(a, chat_id).status_code == 400
    snapshot = heartbeat(a).data
    assert set(snapshot["peer"]) == {"alias", "avatar_id", "shared_interests"}
    assert "email" not in str(snapshot) and "birth_date" not in str(snapshot)
    assert a.post(f"/api/v1/chats/{chat_id}/accept/").data["state"] == "invited"
    assert a.post(f"/api/v1/chats/{chat_id}/accept/").data["state"] == "invited"
    assert b.post(f"/api/v1/chats/{chat_id}/accept/").data["state"] == "active"
    assert send(a, chat_id).status_code == 201


def test_idempotent_queue_and_no_double_pairing(people):
    chat_id = pair(people)
    assert queue(people[0][1]).data["id"] == chat_id
    assert queue(people[2][1]).data["state"] == "waiting"
    assert Conversation.objects.count() == 1
    assert MatchSlot.objects.count() == 3


def test_message_retries_cursor_and_outsider_denial(people):
    chat_id = pair(people)
    a, b, outsider = [p[1] for p in people]
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
    for suffix in ["messages/", "accept/", "typing/", "block/", "report/"]:
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


def test_queue_requires_profile_optin_and_own_intention(people, user):
    client = APIClient()
    client.force_login(user)
    assert queue(client).status_code == 400
    client = people[0][1]
    assert queue(client, intention="flirting").status_code == 400
    prefs = people[0][0].preferences
    prefs.open_chat_opt_in = False
    prefs.save()
    assert queue(client, mode="open").status_code == 400


@pytest.mark.parametrize(
    "kind", ["gender", "age", "language", "intention", "block", "disabled", "unverified"]
)
def test_queue_hard_filters(people, kind):
    a, b = people[0][0], people[1][0]
    queue(people[1][1])
    if kind == "gender":
        b.preferences.genders = ["woman"]
        b.preferences.save()
    elif kind == "age":
        b.preferences.min_age = 40
        b.preferences.save()
    elif kind in {"language", "intention"}:
        field = "languages" if kind == "language" else "intentions"
        setattr(b.profile, field, ["fr"] if kind == "language" else ["friendship"])
        b.profile.save()
    elif kind == "block":
        Block.objects.create(blocker=b, blocked=a)
    elif kind == "disabled":
        b.is_active = False
        b.save()
    else:
        b.email_verified_at = None
        b.save()
    assert queue(people[0][1]).data["state"] == "waiting"
    assert Conversation.objects.count() == 0


def test_expired_waiter_not_matched(people):
    queue(people[0][1])
    MatchSlot.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
    assert queue(people[1][1]).data["state"] == "waiting"


def test_invitation_timeout_releases_both(people):
    chat_id = pair(people, active=False)
    Conversation.objects.update(invitation_expires_at=timezone.now() - timedelta(seconds=1))
    response = people[0][1].post(f"/api/v1/chats/{chat_id}/accept/")
    assert response.data["state"] == "ended"
    assert MatchSlot.objects.count() == 0
    assert send(people[0][1], chat_id).status_code == 400


@pytest.mark.parametrize("action", ["leave", "logout", "block", "preferences", "disconnect"])
def test_end_releases_slots_and_rejects_new_messages(people, action):
    chat_id = pair(people)
    a, b = people[0][1], people[1][1]
    if action == "leave":
        assert a.delete("/api/v1/matching/queue/").status_code == 204
    elif action == "logout":
        assert a.post("/api/v1/auth/logout/").status_code == 204
    elif action == "block":
        assert (
            a.post("/api/v1/blocks/", {"profile_id": str(people[1][0].profile.pk)}, format="json").status_code
            == 204
        )
    elif action == "preferences":
        assert (
            a.put(
                "/api/v1/preferences/",
                {"genders": ["man"], "min_age": 18, "max_age": 40, "open_chat_opt_in": False},
                format="json",
            ).status_code
            == 200
        )
    else:
        MatchSlot.objects.filter(user=people[0][0]).update(expires_at=timezone.now() - timedelta(seconds=1))
        heartbeat(b)
    assert MatchSlot.objects.count() == 0
    assert send(b, chat_id).status_code == 400
    assert Conversation.objects.get(pk=chat_id).status == "ended"


def test_report_evidence_idempotence_and_block(people):
    chat_id = pair(people)
    a = people[0][1]
    send(a, chat_id, "Evidence")
    for _ in range(2):
        assert (
            a.post(
                f"/api/v1/chats/{chat_id}/report/",
                {"reason": "harassment", "details": "Please review."},
                format="json",
            ).status_code
            == 204
        )
    assert Report.objects.count() == 1
    assert Report.objects.get().evidence[0]["body"] == "Evidence"
    assert Block.objects.filter(blocker=people[0][0], blocked=people[1][0]).exists()
    assert MatchSlot.objects.count() == 0


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
            return join(user, "compatible", "dating")
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(attempt, [p[0].pk for p in people]))
    assert Conversation.objects.count() == 1
    assert MatchSlot.objects.exclude(conversation=None).count() == 2


@pytest.mark.asyncio
async def test_two_sessions_receive_chat_events_and_recover_messages(people):
    # Real ASGI sockets and session cookies, backed by the isolated test database.
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
        for ws in sockets:
            assert (await ws.connect())[0]
            assert (await ws.receive_json_from())["type"] == "connection.ready"
        sent = await database_sync_to_async(send)(a, chat_id, "Hello through the live flow")
        for ws in sockets:
            assert await ws.receive_json_from() == {"type": "chat.changed", "conversation_id": chat_id}
        received = await database_sync_to_async(b.get)(f"/api/v1/chats/{chat_id}/messages/")
        assert received.data["messages"][0]["id"] == sent.data["id"]
        await database_sync_to_async(a.post)(f"/api/v1/chats/{chat_id}/typing/")
        assert (await sockets[1].receive_json_from())["type"] == "chat.typing"
        await sockets[1].disconnect()
        await database_sync_to_async(send)(a, chat_id, "Sent while the socket was disconnected")
        recovered = await database_sync_to_async(b.get)(
            f"/api/v1/chats/{chat_id}/messages/?after={sent.data['id']}"
        )
        assert len(recovered.data["messages"]) == 1
    finally:
        for ws in sockets:
            await ws.disconnect()
