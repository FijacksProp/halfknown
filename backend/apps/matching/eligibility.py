from django.db.models import Q
from django.utils import timezone

from apps.moderation.models import Block
from apps.profiles.catalog import age_on


def eligible(left, right, *, mode="random", intention="conversation", today=None):
    """Safety and availability gates for the random queue."""
    if left.pk == right.pk:
        return False
    for user in (left, right):
        if not user.is_active or not user.email_verified_at:
            return False
        if not all(hasattr(user, relation) for relation in ("profile", "private_profile", "preferences")):
            return False
    if Block.objects.filter(Q(blocker=left, blocked=right) | Q(blocker=right, blocked=left)).exists():
        return False
    return all(
        user.private_profile.adult_confirmed_at
        or (
            user.private_profile.birth_date
            and age_on(user.private_profile.birth_date, today or timezone.localdate()) >= 18
        )
        for user in (left, right)
    )
