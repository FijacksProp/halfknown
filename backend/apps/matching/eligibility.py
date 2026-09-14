from django.db.models import Q
from django.utils import timezone

from apps.moderation.models import Block
from apps.profiles.catalog import age_on


def eligible(left, right, *, mode, intention, today=None):
    """Mutual hard filters only. Availability/reservations belong to the future queue service."""
    if mode not in {"open", "compatible"} or left.pk == right.pk:
        return False
    for user in (left, right):
        if not user.is_active or not user.email_verified_at:
            return False
        if not all(hasattr(user, relation) for relation in ("profile", "private_profile", "preferences")):
            return False
    if Block.objects.filter(Q(blocker=left, blocked=right) | Q(blocker=right, blocked=left)).exists():
        return False
    today = today or timezone.localdate()
    left_age = age_on(left.private_profile.birth_date, today)
    right_age = age_on(right.private_profile.birth_date, today)
    if min(left_age, right_age) < 18:
        return False
    if not (
        left.preferences.min_age <= right_age <= left.preferences.max_age
        and right.preferences.min_age <= left_age <= right.preferences.max_age
    ):
        return False
    if intention not in left.profile.intentions or intention not in right.profile.intentions:
        return False
    if not set(left.profile.languages) & set(right.profile.languages):
        return False
    if mode == "open":
        return left.preferences.open_chat_opt_in and right.preferences.open_chat_opt_in
    return (
        right.profile.gender in left.preferences.genders and left.profile.gender in right.preferences.genders
    )
