from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.profiles.models import Profile

from .models import Block


class BlockInput(serializers.Serializer):
    profile_id = serializers.UUIDField()


class BlockView(APIView):
    def post(self, request):
        data = BlockInput(data=request.data)
        data.is_valid(raise_exception=True)
        target = get_object_or_404(Profile, pk=data.validated_data["profile_id"])
        if target.user_id == request.user.pk:
            raise serializers.ValidationError("You cannot block yourself.")
        Block.objects.get_or_create(blocker=request.user, blocked_id=target.user_id)
        return Response(status=204)
