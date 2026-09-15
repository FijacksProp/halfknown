import uuid

from django.conf import settings
from django.db import models


class MatchGate(models.Model):
    """MVP serialization point, shared by all workers (not a process-local lock)."""

    revision = models.PositiveBigIntegerField(default=0)


class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="first_chats")
    second = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="second_chats"
    )
    mode = models.CharField(max_length=16)
    intention = models.CharField(max_length=24)
    status = models.CharField(max_length=12, default="invited")
    first_accepted = models.BooleanField(default=False)
    second_accepted = models.BooleanField(default=False)
    invitation_expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    end_reason = models.CharField(max_length=24, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=~models.Q(first=models.F("second")), name="chat_no_self_match"),
        ]


class MatchSlot(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, primary_key=True)
    conversation = models.ForeignKey(Conversation, null=True, blank=True, on_delete=models.CASCADE)
    mode = models.CharField(max_length=16)
    intention = models.CharField(max_length=24)
    joined_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)

    class Meta:
        indexes = [models.Index(fields=["mode", "intention", "joined_at"], name="match_queue_order")]


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    client_id = models.UUIDField()
    body = models.CharField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["sender", "client_id"], name="message_idempotency"),
        ]
        indexes = [models.Index(fields=["conversation", "id"], name="chat_message_cursor")]
