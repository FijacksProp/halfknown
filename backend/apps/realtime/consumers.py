import asyncio
from collections import deque
from contextlib import suppress
from time import monotonic

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.sessions.models import Session
from django.utils import timezone

from apps.accounts.models import User


class AccountConsumer(AsyncJsonWebsocketConsumer):
    """Private event stream. No client may publish an invitation or claim a match."""

    async def connect(self):
        self.received_at = deque()
        self.watchdog = None
        self.group_name = None
        self.user = self.scope["user"]
        if not self.user.is_authenticated or not await self.session_valid():
            await self.close(code=4401)
            return
        self.group_name = f"account.{self.user.pk.hex}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({"type": "connection.ready"})
        self.watchdog = asyncio.create_task(self.check_session())

    @database_sync_to_async
    def session_valid(self):
        key = self.scope["session"].session_key
        return bool(
            key
            and User.objects.filter(pk=self.user.pk, is_active=True, email_verified_at__isnull=False).exists()
            and Session.objects.filter(session_key=key, expire_date__gt=timezone.now()).exists()
        )

    async def check_session(self):
        while True:
            await asyncio.sleep(30)
            if not await self.session_valid():
                await self.close(code=4401)
                return

    async def receive(self, text_data=None, bytes_data=None, **kwargs):
        now = monotonic()
        while self.received_at and self.received_at[0] < now - 10:
            self.received_at.popleft()
        if len(self.received_at) >= 20:
            await self.close(code=4429)
            return
        self.received_at.append(now)
        if bytes_data is not None or (text_data and len(text_data.encode("utf-8")) > 1024):
            await self.close(code=4400)
            return
        try:
            await super().receive(text_data=text_data, bytes_data=bytes_data, **kwargs)
        except (ValueError, TypeError):
            await self.send_json({"type": "error", "detail": "Invalid event."})

    async def receive_json(self, content, **kwargs):
        if not await self.session_valid():
            await self.close(code=4401)
            return
        if isinstance(content, dict) and content == {"type": "ping"}:
            await self.send_json({"type": "pong"})
        else:
            await self.send_json({"type": "error", "detail": "Unsupported event."})

    async def account_event(self, event):
        if not await self.session_valid():
            await self.close(code=4401)
            return
        await self.send_json(event["payload"])

    async def disconnect(self, code):
        if self.watchdog:
            self.watchdog.cancel()
            with suppress(asyncio.CancelledError):
                await self.watchdog
        if self.group_name:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
