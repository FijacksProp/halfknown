from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.debug import sensitive_post_parameters
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.profiles.models import Profile

from .models import Report


class BlockInput(serializers.Serializer):
    profile_id = serializers.UUIDField()


class BlockView(APIView):
    def post(self, request):
        data = BlockInput(data=request.data)
        data.is_valid(raise_exception=True)
        target = get_object_or_404(Profile, pk=data.validated_data["profile_id"])
        if target.user_id == request.user.pk:
            raise serializers.ValidationError("You cannot block yourself.")
        from apps.matching.services import block_peer

        block_peer(request.user, target.user_id)
        return Response(status=204)


class ReportInput(serializers.Serializer):
    reason = serializers.ChoiceField(
        choices=["harassment", "sexual_content", "underage", "spam", "threats", "other"]
    )
    details = serializers.CharField(max_length=2000, allow_blank=True, default="")


@method_decorator(sensitive_post_parameters("details"), name="dispatch")
class ChatSafetyView(APIView):
    def post(self, request, chat_id, action):
        from apps.matching import services

        with services.match_lock():
            chat = services.chat_for(request.user, chat_id)
            target_id = chat.second_id if chat.first_id == request.user.pk else chat.first_id
            if action == "report":
                data = ReportInput(data=request.data)
                data.is_valid(raise_exception=True)
                evidence = list(chat.messages.order_by("-pk")[:20])
                Report.objects.get_or_create(
                    conversation=chat,
                    reporter=request.user,
                    defaults={
                        "reported_id": target_id,
                        **data.validated_data,
                        "evidence": [
                            {
                                "id": m.pk,
                                "sender_id": str(m.sender_id),
                                "body": m.body,
                                "created_at": m.created_at.isoformat(),
                            }
                            for m in reversed(evidence)
                        ],
                    },
                )
            services.block_peer(request.user, target_id)
        return Response(status=204)
