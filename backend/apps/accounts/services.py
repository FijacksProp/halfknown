import hmac
import secrets
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac

from .models import LoginChallenge, User
from .tasks import send_login_code


def digest(challenge_id, code):
    return salted_hmac("halfknown.login", f"{challenge_id}:{code}", algorithm="sha256").hexdigest()


def request_code(email):
    email = email.strip().lower()
    now = timezone.now()
    with transaction.atomic():
        user, _ = User.objects.get_or_create(email=email)
        # Users created without a password must not have a usable password.
        if not user.password:
            user.set_unusable_password()
            user.save(update_fields=["password"])
        user = User.objects.select_for_update().get(pk=user.pk)
        if not user.is_active:
            return uuid.uuid4()
        previous = LoginChallenge.objects.filter(user=user).first()
        if previous and (now - previous.sent_at).total_seconds() < settings.OTP_RESEND_SECONDS:
            return previous.challenge_id
        window_start, sends = now, 0
        if previous and now - previous.window_started_at < timedelta(hours=1):
            window_start, sends = previous.window_started_at, previous.sends_in_window
        if sends >= settings.OTP_MAX_SENDS_PER_HOUR:
            return previous.challenge_id
        challenge_id = uuid.uuid4()
        code = f"{secrets.randbelow(1_000_000):06d}"
        LoginChallenge.objects.update_or_create(
            user=user,
            defaults={
                "challenge_id": challenge_id,
                "code_digest": digest(challenge_id, code),
                "expires_at": now + timedelta(seconds=settings.OTP_TTL_SECONDS),
                "sent_at": now,
                "attempts": 0,
                "consumed_at": None,
                "window_started_at": window_start,
                "sends_in_window": sends + 1,
            },
        )
        transaction.on_commit(
            lambda: send_login_code.apply_async(
                args=[email, code],
                expires=settings.OTP_TTL_SECONDS,
                argsrepr="(<private email>, <redacted code>)",
            )
        )
    return challenge_id


def verify_code(challenge_id, code):
    with transaction.atomic():
        user_id = (
            LoginChallenge.objects.filter(challenge_id=challenge_id).values_list("user_id", flat=True).first()
        )
        if not user_id:
            return None
        user = User.objects.select_for_update().get(pk=user_id)
        challenge = LoginChallenge.objects.get(user=user)
        now = timezone.now()
        if (
            challenge.challenge_id != challenge_id
            or not user.is_active
            or challenge.consumed_at
            or now >= challenge.expires_at
            or challenge.attempts >= settings.OTP_MAX_ATTEMPTS
        ):
            return None
        challenge.attempts += 1
        valid = hmac.compare_digest(challenge.code_digest, digest(challenge_id, code))
        if valid:
            challenge.consumed_at = now
            if not user.email_verified_at:
                user.email_verified_at = now
                user.save(update_fields=["email_verified_at"])
        challenge.save(update_fields=["attempts", "consumed_at"])
        return user if valid else None
