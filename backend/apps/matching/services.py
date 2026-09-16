import logging
import secrets
from contextlib import contextmanager
from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone
from rest_framework.exceptions import NotFound, Throttled, ValidationError

from apps.accounts.models import User
from apps.moderation.models import Block
from apps.profiles.catalog import age_on

from .eligibility import eligible
from .models import Conversation, MatchGate, MatchSlot, Message

log = logging.getLogger(__name__)
LEASE_SECONDS = 90
PRESENT_SECONDS = 30
REMATCH_COOLDOWN = timedelta(minutes=10)


@contextmanager
def match_lock():
    # UPDATE acquires a write lock before reads on SQLite, and a row lock on PostgreSQL.
    # Seeded by migration. This intentionally favors correctness over MVP throughput.
    with transaction.atomic():
        if not MatchGate.objects.filter(pk=1).update(revision=F("revision") + 1):
            MatchGate.objects.create(pk=1)
        yield


def notify(user_ids, payload=None):
    payload = payload or {"type": "match.changed"}

    def publish():
        try:
            layer = get_channel_layer()
            for uid in user_ids:
                async_to_sync(layer.group_send)(
                    f"account.{uid.hex}", {"type": "account.event", "payload": payload}
                )
        except Exception:
            # No message bodies in logs. REST resync recovers a lost event.
            log.warning("Realtime notification unavailable; clients must resync.")

    transaction.on_commit(publish)


def end_chat(chat, reason, *, requeue=()):
    if chat.status == "ended":
        return
    now = timezone.now()
    slots = list(MatchSlot.objects.filter(conversation=chat))
    chat.status, chat.end_reason, chat.ended_at = "ended", reason, now
    chat.save(update_fields=["status", "end_reason", "ended_at"])
    MatchSlot.objects.filter(conversation=chat).delete()
    for slot in slots:
        if slot.user_id not in requeue or slot.expires_at <= now + timedelta(
            seconds=LEASE_SECONDS - PRESENT_SECONDS
        ):
            continue
        try:
            queue_valid(fresh_user(slot.user_id), slot.mode, slot.intention)
        except ValidationError:
            continue
        MatchSlot.objects.create(
            user_id=slot.user_id, mode=slot.mode, intention=slot.intention, expires_at=slot.expires_at
        )
    notify([chat.first_id, chat.second_id])


def sweep():
    now = timezone.now()
    expired = MatchSlot.objects.filter(expires_at__lte=now)
    ids = list(expired.exclude(conversation=None).values_list("conversation_id", flat=True))
    expired.filter(conversation=None).delete()
    for chat in Conversation.objects.filter(
        Q(pk__in=ids) | Q(status="invited", invitation_expires_at__lte=now)
    ).exclude(status="ended"):
        if chat.status == "invited":
            # Only an accepted invitation and recent presence authorize resuming.
            continuing = [
                uid
                for uid, accepted in (
                    (chat.first_id, chat.first_accepted),
                    (chat.second_id, chat.second_accepted),
                )
                if accepted
            ]
            end_chat(chat, "expired", requeue=continuing)
        else:
            end_chat(chat, "disconnected")


def fresh_user(uid):
    return User.objects.select_related("profile", "private_profile", "preferences").get(pk=uid)


def ready_user(user):
    if (
        not user.is_active
        or not user.email_verified_at
        or not all(hasattr(user, field) for field in ("profile", "private_profile", "preferences"))
        or age_on(user.private_profile.birth_date, timezone.localdate()) < 18
    ):
        raise ValidationError("Complete your verified adult profile first.")


def queue_valid(user, mode, intention):
    ready_user(user)
    if mode not in {"open", "compatible"} or intention not in user.profile.intentions:
        raise ValidationError("Choose a mode and an intention from your profile.")
    if mode == "open" and not user.preferences.open_chat_opt_in:
        raise ValidationError("Enable Open Chat in your preferences first.")


def chat_for(user, chat_id):
    chat = Conversation.objects.filter(pk=chat_id).filter(Q(first=user) | Q(second=user)).first()
    if not chat:
        raise NotFound("Conversation not found.")
    return chat


def chat_eligible(chat):
    return eligible(
        fresh_user(chat.first_id), fresh_user(chat.second_id), mode=chat.mode, intention=chat.intention
    )


def try_pair(slot):
    user = fresh_user(slot.user_id)
    queue_valid(user, slot.mode, slot.intention)
    recent = Conversation.objects.filter(ended_at__gt=timezone.now() - REMATCH_COOLDOWN)
    excluded = set(recent.filter(first=user).values_list("second_id", flat=True))
    excluded.update(recent.filter(second=user).values_list("first_id", flat=True))
    # Bounded FIFO candidate band. Random for Open Chat; shared interests rank Compatible.
    candidates = list(
        MatchSlot.objects.filter(conversation=None, mode=slot.mode, intention=slot.intention)
        .exclude(user=user)
        .exclude(user_id__in=excluded)
        .select_related("user__profile", "user__private_profile", "user__preferences")
        .order_by("joined_at")[:200]
    )
    candidates = [c for c in candidates if eligible(user, c.user, mode=slot.mode, intention=slot.intention)]
    if not candidates:
        return
    if slot.mode == "compatible":
        scores = [len(set(user.profile.interests) & set(c.user.profile.interests)) for c in candidates]
        candidates = [c for c, score in zip(candidates, scores) if score == max(scores)]
    other = secrets.choice(candidates)
    chat = Conversation.objects.create(
        first=user,
        second=other.user,
        mode=slot.mode,
        intention=slot.intention,
        invitation_expires_at=timezone.now() + timedelta(seconds=45),
    )
    MatchSlot.objects.filter(user_id__in=[user.pk, other.user_id]).update(conversation=chat)
    notify([user.pk, other.user_id])


def snapshot(user):
    slot = MatchSlot.objects.filter(user=user).select_related("conversation").first()
    if not slot:
        return {"state": "idle"}
    if not slot.conversation_id:
        return {"state": "waiting", "mode": slot.mode, "intention": slot.intention}
    return chat_snapshot(slot.conversation, user)


def chat_snapshot(chat, user):
    peer_id = chat.second_id if chat.first_id == user.pk else chat.first_id
    peer = fresh_user(peer_id).profile
    own = fresh_user(user.pk).profile
    return {
        "state": chat.status,
        "id": str(chat.pk),
        "mode": chat.mode,
        "intention": chat.intention,
        "accepted": chat.first_accepted if chat.first_id == user.pk else chat.second_accepted,
        "expires_at": chat.invitation_expires_at.isoformat(),
        "end_reason": chat.end_reason,
        "peer": {
            "alias": peer.alias,
            "avatar_id": peer.avatar_id,
            "shared_interests": sorted(set(own.interests) & set(peer.interests)),
        },
    }


def join(user, mode, intention):
    with match_lock():
        sweep()
        queue_valid(fresh_user(user.pk), mode, intention)
        slot = MatchSlot.objects.filter(user=user).first()
        if slot:
            return snapshot(user)
        # A brief requeue delay prevents rapid skip harassment.
        if Conversation.objects.filter(
            Q(first=user) | Q(second=user), ended_at__gt=timezone.now() - timedelta(seconds=3)
        ).exists():
            raise Throttled(wait=3, detail="Please wait a moment before another introduction.")
        slot = MatchSlot.objects.create(
            user=user,
            mode=mode,
            intention=intention,
            expires_at=timezone.now() + timedelta(seconds=LEASE_SECONDS),
        )
        try_pair(slot)
        return snapshot(user)


def heartbeat(user):
    with match_lock():
        sweep()
        slot = MatchSlot.objects.filter(user=user).select_related("conversation").first()
        if slot:
            if slot.conversation and not chat_eligible(slot.conversation):
                end_chat(slot.conversation, "unavailable")
            else:
                slot.expires_at = timezone.now() + timedelta(seconds=LEASE_SECONDS)
                slot.save(update_fields=["expires_at"])
                if not slot.conversation:
                    try:
                        queue_valid(fresh_user(user.pk), slot.mode, slot.intention)
                    except ValidationError:
                        slot.delete()
                    else:
                        try_pair(slot)
        return snapshot(user)


def leave(user):
    with match_lock():
        slot = MatchSlot.objects.filter(user=user).select_related("conversation").first()
        if slot and slot.conversation:
            end_chat(slot.conversation, "left")
        elif slot:
            slot.delete()
        notify([user.pk])


def next_person(user, chat_id, *, decline=False):
    with match_lock():
        sweep()
        chat = chat_for(user, chat_id)
        # A stale request cannot end a newer chat or restart an explicitly stopped search.
        if chat.status == "ended":
            return snapshot(user)
        expected = "invited" if decline else "active"
        if chat.status != expected:
            raise ValidationError("This introduction has changed. Refresh to continue.")
        MatchSlot.objects.filter(user=user, conversation=chat).update(
            expires_at=timezone.now() + timedelta(seconds=LEASE_SECONDS)
        )
        continuing = [chat.first_id, chat.second_id] if decline else [user.pk]
        end_chat(chat, "declined" if decline else "next", requeue=continuing)
        for uid in continuing:
            slot = MatchSlot.objects.filter(user_id=uid, conversation=None).first()
            if slot:
                try_pair(slot)
        return snapshot(user)


def accept(user, chat_id):
    with match_lock():
        sweep()
        chat = chat_for(user, chat_id)
        if chat.status != "invited":
            return chat_snapshot(chat, user)
        if not chat_eligible(chat):
            end_chat(chat, "unavailable")
            return chat_snapshot(chat, user)
        field = "first_accepted" if chat.first_id == user.pk else "second_accepted"
        setattr(chat, field, True)
        if chat.first_accepted and chat.second_accepted:
            chat.status = "active"
        chat.save(update_fields=[field, "status"])
        notify([chat.first_id, chat.second_id])
        return chat_snapshot(chat, user)


def message_data(message, user):
    return {
        "id": message.pk,
        "client_id": str(message.client_id),
        "body": message.body,
        "mine": message.sender_id == user.pk,
        "created_at": message.created_at.isoformat(),
    }


def send_message(user, chat_id, client_id, body):
    with match_lock():
        sweep()
        chat = chat_for(user, chat_id)
        previous = Message.objects.filter(sender=user, client_id=client_id).first()
        if previous:
            if previous.conversation_id != chat.pk or previous.body != body:
                raise ValidationError("That message identifier has already been used.")
            return message_data(previous, user)
        if chat.status != "active" or not chat_eligible(chat):
            raise ValidationError("This conversation is no longer available.")
        if (
            Message.objects.filter(
                sender=user, created_at__gte=timezone.now() - timedelta(seconds=10)
            ).count()
            >= 10
        ):
            raise Throttled(wait=10, detail="Please slow down before sending more messages.")
        message = Message.objects.create(conversation=chat, sender=user, client_id=client_id, body=body)
        # Events are invalidations only: membership and session checks guard REST message reads.
        notify([chat.first_id, chat.second_id], {"type": "chat.changed", "conversation_id": str(chat.pk)})
        return message_data(message, user)


def block_peer(user, target_id):
    with match_lock():
        Block.objects.get_or_create(blocker=user, blocked_id=target_id)
        for chat in Conversation.objects.filter(
            Q(first=user, second_id=target_id) | Q(second=user, first_id=target_id)
        ).exclude(status="ended"):
            end_chat(chat, "unavailable")


def typing(user, chat_id):
    with match_lock():
        chat = chat_for(user, chat_id)
        if chat.status != "active" or not chat_eligible(chat):
            raise ValidationError("Conversation unavailable.")
        peer_id = chat.second_id if chat.first_id == user.pk else chat.first_id
        notify([peer_id], {"type": "chat.typing", "conversation_id": str(chat.pk)})
