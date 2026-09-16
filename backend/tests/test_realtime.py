import pytest
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.conf import settings
from django.contrib.sessions.models import Session
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from config.asgi import application

pytestmark = [pytest.mark.django_db(transaction=True), pytest.mark.asyncio]


@database_sync_to_async
def make_session():
    user = User.objects.create_user("socket@example.com", email_verified_at=timezone.now())
    client = APIClient()
    client.force_login(user)
    key = client.cookies[settings.SESSION_COOKIE_NAME].value
    return user, key


def socket(key=None, origin=b"http://localhost:8000"):
    headers = [(b"origin", origin)]
    if key:
        headers.append((b"cookie", f"{settings.SESSION_COOKIE_NAME}={key}".encode()))
    return WebsocketCommunicator(application, "/ws/events/", headers=headers)


async def test_anonymous_socket_rejected():
    ws = socket()
    assert not (await ws.connect())[0]
    await ws.disconnect()


async def test_cross_origin_socket_rejected():
    _, key = await make_session()
    ws = socket(key, origin=b"https://untrusted.example")
    assert not (await ws.connect())[0]
    await ws.disconnect()


async def test_private_events_and_client_cannot_forge_match():
    user, key = await make_session()
    ws = socket(key)
    assert (await ws.connect())[0]
    assert await ws.receive_json_from() == {"type": "connection.ready"}
    await ws.send_json_to({"type": "ping"})
    assert await ws.receive_json_from() == {"type": "pong"}
    await ws.send_json_to({"type": "match.accepted", "user_id": "someone-else"})
    assert (await ws.receive_json_from())["type"] == "error"
    await get_channel_layer().group_send(
        f"account.{user.pk.hex}",
        {
            "type": "account.event",
            "payload": {"type": "test.notification"},
        },
    )
    assert await ws.receive_json_from() == {"type": "test.notification"}
    await ws.disconnect()


async def test_session_revoked_socket_closes_on_next_event():
    _, key = await make_session()
    ws = socket(key)
    await ws.connect()
    await ws.receive_json_from()
    await database_sync_to_async(lambda: Session.objects.filter(session_key=key).delete())()
    await ws.send_json_to({"type": "ping"})
    assert (await ws.receive_output())["code"] == 4401
    await ws.disconnect()


async def test_large_frames_rejected():
    _, key = await make_session()
    ws = socket(key)
    await ws.connect()
    await ws.receive_json_from()
    await ws.send_to(text_data="x" * 1025)
    assert (await ws.receive_output())["code"] == 4400
    await ws.disconnect()


async def test_ping_flood_is_closed_before_unbounded_database_work():
    _, key = await make_session()
    ws = socket(key)
    await ws.connect()
    await ws.receive_json_from()
    for _ in range(20):
        await ws.send_json_to({"type": "ping"})
        assert await ws.receive_json_from() == {"type": "pong"}
    await ws.send_json_to({"type": "ping"})
    assert (await ws.receive_output())["code"] == 4429
    await ws.disconnect()
