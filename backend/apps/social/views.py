from django.db import connection as db_connection
from django.db import transaction
from django.db.models import F, OuterRef, Q, Subquery
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.matching.services import block_peer, chat_eligible, chat_for, notify
from apps.moderation.models import Block
from apps.profiles.catalog import AVATAR_GROUPS, AVATARS, INTENTIONS, INTERESTS, avatar_choices
from apps.profiles.models import Profile
from apps.profiles.serializers import UsernameField

from .models import Connection, DirectMessage, Follow, ShowcaseItem, SocialReport


def blocked_ids(user):
    made = Block.objects.filter(blocker=user).values_list("blocked_id", flat=True)
    received = Block.objects.filter(blocked=user).values_list("blocker_id", flat=True)
    return set(made) | set(received)


def public_profile(profile, viewer, *, known_connection=None, known_connection_data=None):
    owner = profile.user_id == viewer.pk
    connection = None
    if not owner:
        connection = known_connection or connection_for(viewer, profile.user)
        if connection and connection.status == "declined" and connection.requested_by_id != viewer.pk:
            connection = None
    return {
        "id": str(profile.pk),
        "alias": profile.alias,
        "avatar_id": profile.avatar_id,
        "avatar_group": profile.avatar_group or profile.avatar_id.split("-")[0],
        "gender": profile.gender,
        "intentions": profile.intentions,
        "interests": profile.interests,
        "bio": profile.bio,
        "prompt_answer": profile.prompt_answer,
        "discoverable": profile.discoverable if owner else None,
        "verified": False,
        "following": False
        if owner
        else Follow.objects.filter(follower=viewer, followed=profile.user).exists(),
        "followers_count": Follow.objects.filter(followed=profile.user).count(),
        "connection": (
            known_connection_data
            if known_connection_data is not None
            else connection_data(connection, viewer) if connection else None
        ),
        "showcase": [showcase_data(item) for item in profile.user.showcase.order_by("-created_at")[:6]],
    }


def showcase_data(item):
    return {
        "id": str(item.pk),
        "kind": item.kind,
        "title": item.title,
        "description": item.description,
        "created_at": item.created_at.isoformat(),
    }


def pair_ids(user, peer):
    return (user, peer) if user.pk.hex < peer.pk.hex else (peer, user)


def connection_for(user, peer):
    return Connection.objects.filter(
        Q(first=user, second=peer) | Q(first=peer, second=user)
    ).first()


def request_connection(user, peer):
    first, second = pair_ids(user, peer)
    with transaction.atomic():
        changed = False
        connection, created = Connection.objects.get_or_create(
            first=first, second=second, defaults={"requested_by": user, "status": "pending"}
        )
        changed = created
        if not created and connection.status == "pending" and connection.requested_by_id != user.pk:
            connection.status = "accepted"
            connection.save(update_fields=["status", "updated_at"])
            changed = True
        elif not created and connection.status == "declined" and connection.requested_by_id != user.pk:
            connection.status = "pending"
            connection.requested_by = user
            connection.save(update_fields=["status", "requested_by", "updated_at"])
            changed = True
        if changed:
            notify([first.pk, second.pk], {"type": "social.connection.changed", "connection_id": str(connection.pk)})
    return connection, created


def connection_data(connection, viewer):
    peer_id = connection.second_id if connection.first_id == viewer.pk else connection.first_id
    read_at = connection.first_read_at if connection.first_id == viewer.pk else connection.second_read_at
    unread_count = 0
    if connection.status == "accepted":
        # Conversations created before read tracking have no saved read time.
        # A reply is the latest evidence that earlier messages were seen.
        if read_at is None:
            read_at = (
                connection.messages.filter(sender_id=viewer.pk)
                .order_by("-created_at")
                .values_list("created_at", flat=True)
                .first()
            )
        unread_messages = connection.messages.filter(sender_id=peer_id)
        if read_at is not None:
            unread_messages = unread_messages.filter(created_at__gt=read_at)
        unread_count = unread_messages.count()
    return {
        "id": str(connection.pk),
        "status": connection.status,
        "direction": "outgoing" if connection.requested_by_id == viewer.pk else "incoming",
        "unread_count": unread_count,
    }


def visible_target(viewer, profile_id):
    target = get_object_or_404(Profile.objects.select_related("user"), pk=profile_id, user__is_active=True)
    if target.user_id in blocked_ids(viewer):
        return None
    if not target.discoverable and target.user_id != viewer.pk:
        if not Connection.objects.filter(
            Q(first=viewer, second=target.user) | Q(first=target.user, second=viewer),
            status="accepted",
        ).exists():
            return None
    return target


class ProfileEditInput(serializers.Serializer):
    username = UsernameField(required=False)
    avatar_id = serializers.ChoiceField(choices=AVATARS, required=False)
    bio = serializers.CharField(max_length=300, allow_blank=True, required=False)
    prompt_answer = serializers.CharField(max_length=280, allow_blank=True, required=False)
    intentions = serializers.ListField(
        child=serializers.ChoiceField(choices=INTENTIONS), max_length=4, required=False
    )
    interests = serializers.ListField(
        child=serializers.ChoiceField(choices=INTERESTS), max_length=5, required=False
    )
    discoverable = serializers.BooleanField(required=False)

    def validate(self, attrs):
        for key in ("intentions", "interests"):
            if key in attrs and len(attrs[key]) != len(set(attrs[key])):
                raise serializers.ValidationError({key: "Choose each option once."})
        return attrs


class SelfView(APIView):
    def get(self, request):
        profile = get_object_or_404(Profile, user=request.user)
        return Response(public_profile(profile, request.user))

    def patch(self, request):
        profile = get_object_or_404(Profile, user=request.user)
        data = ProfileEditInput(data=request.data, context={"request": request})
        data.is_valid(raise_exception=True)
        if "avatar_id" in data.validated_data:
            group = profile.avatar_group or profile.avatar_id.split("-")[0]
            if data.validated_data["avatar_id"] not in avatar_choices(group, profile.gender):
                raise serializers.ValidationError(
                    {"avatar_id": "Choose a portrait from your assigned creature group."}
                )
            profile.avatar_group = group
        for key, value in data.validated_data.items():
            setattr(profile, "alias" if key == "username" else key, value)
        if data.validated_data:
            update_fields = ["alias" if key == "username" else key for key in data.validated_data]
            update_fields.append("updated_at")
            if "avatar_id" in data.validated_data:
                update_fields.append("avatar_group")
            profile.save(update_fields=update_fields)
        return Response(public_profile(profile, request.user))


class DiscoverView(APIView):
    def get(self, request):
        if not Profile.objects.filter(user=request.user).exists():
            return Response({"detail": "Complete your profile first."}, status=409)
        profiles = Profile.objects.filter(discoverable=True, user__is_active=True).exclude(user=request.user)
        profiles = profiles.exclude(user_id__in=blocked_ids(request.user))
        interest = request.query_params.get("interest", "")
        group = request.query_params.get("group", "")
        search = request.query_params.get("q", "").strip()[:80]
        if interest:
            if interest not in INTERESTS:
                raise serializers.ValidationError({"interest": "Unknown interest."})
            if db_connection.vendor == "postgresql":
                profiles = profiles.filter(interests__contains=[interest])
        if group:
            if group not in AVATAR_GROUPS:
                raise serializers.ValidationError({"group": "Unknown character group."})
            profiles = profiles.filter(avatar_group=group)
        if search:
            profiles = profiles.filter(Q(alias__icontains=search) | Q(bio__icontains=search))
        try:
            offset = max(0, min(int(request.query_params.get("offset", "0")), 1000))
        except ValueError:
            raise serializers.ValidationError({"offset": "Use a number."}) from None
        profiles = profiles.select_related("user").order_by("-updated_at", "id")
        if interest and db_connection.vendor != "postgresql":
            profiles = list(profiles)
            profiles = [profile for profile in profiles if interest in profile.interests]
        return Response(
            {
                "results": [public_profile(p, request.user) for p in profiles[offset : offset + 24]],
                "next_offset": offset + 24 if len(profiles) > offset + 24 else None,
            }
        )


class PublicProfileView(APIView):
    def get(self, request, profile_id):
        target = visible_target(request.user, profile_id)
        if not target:
            return Response({"detail": "Profile unavailable."}, status=404)
        return Response(public_profile(target, request.user))


class FollowView(APIView):
    def post(self, request, profile_id):
        target = visible_target(request.user, profile_id)
        if not target or target.user_id == request.user.pk:
            return Response({"detail": "Profile unavailable."}, status=404)
        Follow.objects.get_or_create(follower=request.user, followed=target.user)
        return Response(public_profile(target, request.user))

    def delete(self, request, profile_id):
        target = get_object_or_404(Profile, pk=profile_id)
        Follow.objects.filter(follower=request.user, followed=target.user).delete()
        return Response(status=204)


class ConnectionView(APIView):
    def get_throttles(self):
        if self.request.method == "POST":
            self.throttle_scope = "social_connect"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def post(self, request, profile_id):
        target = visible_target(request.user, profile_id)
        if not target or target.user_id == request.user.pk:
            return Response({"detail": "Profile unavailable."}, status=404)
        connection, created = request_connection(request.user, target.user)
        return Response(connection_data(connection, request.user), status=201 if created else 200)

    def delete(self, request, profile_id):
        target = get_object_or_404(Profile, pk=profile_id)
        first, second = pair_ids(request.user, target.user)
        removed, _ = Connection.objects.filter(first=first, second=second).exclude(status="declined").delete()
        if removed:
            notify([first.pk, second.pk], {"type": "social.connection.changed"})
        return Response(status=204)


class ConnectionAcceptView(APIView):
    def post(self, request, connection_id):
        connection = get_object_or_404(Connection, pk=connection_id, status="pending")
        if (
            request.user.pk not in (connection.first_id, connection.second_id)
            or connection.requested_by_id == request.user.pk
        ):
            return Response({"detail": "Request unavailable."}, status=404)
        if connection.first_id in blocked_ids(request.user) or connection.second_id in blocked_ids(
            request.user
        ):
            return Response({"detail": "Request unavailable."}, status=404)
        connection.status = "accepted"
        connection.save(update_fields=["status", "updated_at"])
        notify([connection.first_id, connection.second_id], {"type": "social.connection.changed", "connection_id": str(connection.pk)})
        return Response(connection_data(connection, request.user))


class QuickConnectionView(APIView):
    def get_throttles(self):
        if self.request.method == "POST":
            self.throttle_scope = "social_connect"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def active_chat(self, request, chat_id):
        chat = chat_for(request.user, chat_id)
        if chat.status != "active" or not chat_eligible(chat):
            return None, None
        peer = chat.second if chat.first_id == request.user.pk else chat.first
        if peer.pk in blocked_ids(request.user):
            return None, None
        return chat, peer

    def get(self, request, chat_id):
        chat, peer = self.active_chat(request, chat_id)
        if not chat:
            return Response({"detail": "Conversation unavailable."}, status=409)
        connection = connection_for(request.user, peer)
        if connection and connection.status == "declined" and connection.requested_by_id != request.user.pk:
            connection = None
        return Response({"connection": connection_data(connection, request.user) if connection else None})

    def post(self, request, chat_id):
        chat, peer = self.active_chat(request, chat_id)
        if not chat:
            return Response({"detail": "Conversation unavailable."}, status=409)
        connection, created = request_connection(request.user, peer)
        return Response(connection_data(connection, request.user), status=201 if created else 200)

    def delete(self, request, chat_id):
        chat, peer = self.active_chat(request, chat_id)
        if not chat:
            return Response({"detail": "Conversation unavailable."}, status=409)
        connection = connection_for(request.user, peer)
        if not connection or connection.status != "pending" or connection.requested_by_id == request.user.pk:
            return Response({"detail": "Request unavailable."}, status=404)
        connection.status = "declined"
        connection.save(update_fields=["status", "updated_at"])
        notify(
            [chat.first_id, chat.second_id],
            {"type": "connection.changed", "conversation_id": str(chat.pk)},
        )
        return Response(status=204)


class ConnectionsView(APIView):
    def get(self, request):
        latest = DirectMessage.objects.filter(connection_id=OuterRef("pk")).order_by("-pk")
        connections = (
            Connection.objects.filter(Q(first=request.user) | Q(second=request.user))
            .exclude(status="declined")
            .annotate(
                last_message_body=Subquery(latest.values("body")[:1]),
                last_message_created_at=Subquery(latest.values("created_at")[:1]),
                last_message_sender_id=Subquery(latest.values("sender_id")[:1]),
            )
            .select_related("first__profile", "second__profile")
            .order_by(F("last_message_created_at").desc(nulls_last=True), "-updated_at")[:100]
        )
        hidden = blocked_ids(request.user)
        results = []
        for connection in connections:
            peer = connection.second if connection.first_id == request.user.pk else connection.first
            if peer.pk not in hidden and hasattr(peer, "profile"):
                data = connection_data(connection, request.user)
                results.append(
                    {
                        "peer": public_profile(
                            peer.profile,
                            request.user,
                            known_connection=connection,
                            known_connection_data=data,
                        ),
                        "last_message": (
                            {
                                "body": connection.last_message_body,
                                "mine": str(connection.last_message_sender_id).replace("-", "") == request.user.pk.hex,
                                "created_at": connection.last_message_created_at.isoformat(),
                            }
                            if connection.last_message_created_at
                            else None
                        ),
                        **data,
                    }
                )
        return Response({"results": results})


class MessageInput(serializers.Serializer):
    body = serializers.CharField(max_length=2000, trim_whitespace=True)


class MessagesView(APIView):
    def get_throttles(self):
        if self.request.method == "POST":
            self.throttle_scope = "social_message"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def connection(self, request, connection_id):
        connection = get_object_or_404(Connection, pk=connection_id, status="accepted")
        if request.user.pk not in (connection.first_id, connection.second_id):
            return None
        peer_id = connection.second_id if connection.first_id == request.user.pk else connection.first_id
        return None if peer_id in blocked_ids(request.user) else connection

    def get(self, request, connection_id):
        connection = self.connection(request, connection_id)
        if not connection:
            return Response({"detail": "Conversation unavailable."}, status=404)
        try:
            after = max(0, int(request.query_params.get("after", "0")))
        except ValueError:
            raise serializers.ValidationError({"after": "Use a number."}) from None
        messages = list(connection.messages.filter(pk__gt=after).order_by("pk")[:100])
        latest_seen = max(
            (message.created_at for message in messages if message.sender_id != request.user.pk),
            default=None,
        )
        if latest_seen is not None:
            read_field = "first_read_at" if connection.first_id == request.user.pk else "second_read_at"
            current_read_at = getattr(connection, read_field)
            if current_read_at is None or latest_seen > current_read_at:
                setattr(connection, read_field, latest_seen)
                connection.save(update_fields=[read_field])
        # Reading is persisted before the response; a later inbox refresh sees the new count.
        return Response({"results": [self.output(message, request.user) for message in messages]})

    def post(self, request, connection_id):
        connection = self.connection(request, connection_id)
        if not connection:
            return Response({"detail": "Conversation unavailable."}, status=404)
        data = MessageInput(data=request.data)
        data.is_valid(raise_exception=True)
        message = DirectMessage.objects.create(
            connection=connection, sender=request.user, **data.validated_data
        )
        notify(
            [connection.first_id, connection.second_id],
            {"type": "social.message.changed", "connection_id": str(connection.pk)},
        )
        return Response(self.output(message, request.user), status=201)

    @staticmethod
    def output(message, viewer):
        return {
            "id": message.pk,
            "body": message.body,
            "mine": message.sender_id == viewer.pk,
            "created_at": message.created_at.isoformat(),
        }


class ShowcaseInput(serializers.Serializer):
    kind = serializers.ChoiceField(choices=["talent", "project", "interest"])
    title = serializers.CharField(max_length=80)
    description = serializers.CharField(max_length=300)


class ShowcaseView(APIView):
    def post(self, request):
        if not Profile.objects.filter(user=request.user).exists():
            return Response({"detail": "Complete your profile first."}, status=409)
        data = ShowcaseInput(data=request.data)
        data.is_valid(raise_exception=True)
        if ShowcaseItem.objects.filter(owner=request.user).count() >= 6:
            return Response({"detail": "You can share up to six things."}, status=409)
        item = ShowcaseItem.objects.create(owner=request.user, **data.validated_data)
        return Response(showcase_data(item), status=201)


class ShowcaseDeleteView(APIView):
    def delete(self, request, item_id):
        item = get_object_or_404(ShowcaseItem, pk=item_id, owner=request.user)
        item.delete()
        return Response(status=204)


class SafetyInput(serializers.Serializer):
    reason = serializers.ChoiceField(
        choices=["harassment", "sexual_content", "underage", "spam", "threats", "other"], required=False
    )
    details = serializers.CharField(max_length=2000, allow_blank=True, default="")


class SocialSafetyView(APIView):
    def post(self, request, profile_id, action):
        target = get_object_or_404(Profile, pk=profile_id)
        if target.user_id == request.user.pk:
            raise serializers.ValidationError("You cannot report or block yourself.")
        if action == "report":
            data = SafetyInput(data=request.data)
            data.is_valid(raise_exception=True)
            if "reason" not in data.validated_data:
                raise serializers.ValidationError({"reason": "Choose a reason."})
            connection = connection_for(request.user, target.user)
            evidence = []
            if connection:
                evidence = [
                    {"sender_id": str(m.sender_id), "body": m.body, "created_at": m.created_at.isoformat()}
                    for m in reversed(list(connection.messages.order_by("-pk")[:20]))
                ]
            SocialReport.objects.create(
                reporter=request.user, reported=target.user, evidence=evidence, **data.validated_data
            )
        block_peer(request.user, target.user_id)
        with transaction.atomic():
            Follow.objects.filter(
                Q(follower=request.user, followed=target.user)
                | Q(follower=target.user, followed=request.user)
            ).delete()
            first, second = pair_ids(request.user, target.user)
            Connection.objects.filter(first=first, second=second).delete()
            notify([first.pk, second.pk], {"type": "social.connection.changed"})
        return Response(status=204)
