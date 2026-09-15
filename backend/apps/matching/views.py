from django.utils.decorators import method_decorator
from django.views.decorators.debug import sensitive_post_parameters
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import services
from .models import Message


class QueueInput(serializers.Serializer):
    mode = serializers.ChoiceField(choices=["open", "compatible"])
    intention = serializers.CharField(max_length=24)


class MessageInput(serializers.Serializer):
    client_id = serializers.UUIDField()
    body = serializers.CharField(max_length=2000, allow_blank=False, trim_whitespace=True)


class QueueView(APIView):
    def post(self, request):
        data = QueueInput(data=request.data)
        data.is_valid(raise_exception=True)
        return Response(services.join(request.user, **data.validated_data))

    def delete(self, request):
        services.leave(request.user)
        return Response(status=204)


class HeartbeatView(APIView):
    def post(self, request):
        return Response(services.heartbeat(request.user))


class AcceptView(APIView):
    def post(self, request, chat_id):
        return Response(services.accept(request.user, chat_id))


@method_decorator(sensitive_post_parameters("body"), name="dispatch")
class MessagesView(APIView):
    def get(self, request, chat_id):
        chat = services.chat_for(request.user, chat_id)
        try:
            after = int(request.query_params.get("after", "0"))
            if not 0 <= after <= 9223372036854775807:
                raise ValueError
        except (TypeError, ValueError):
            raise serializers.ValidationError("Invalid message cursor.") from None
        rows = list(Message.objects.filter(conversation=chat, pk__gt=after).order_by("pk")[:101])
        return Response(
            {
                "messages": [services.message_data(m, request.user) for m in rows[:100]],
                "has_more": len(rows) > 100,
                "conversation": services.chat_snapshot(chat, request.user),
            }
        )

    def post(self, request, chat_id):
        data = MessageInput(data=request.data)
        data.is_valid(raise_exception=True)
        return Response(services.send_message(request.user, chat_id, **data.validated_data), status=201)


class TypingView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "typing"

    def post(self, request, chat_id):
        services.typing(request.user, chat_id)
        return Response(status=204)
