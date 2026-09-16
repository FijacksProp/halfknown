from celery import shared_task
from django.contrib.sessions.models import Session
from django.utils import timezone

from .services import match_lock, sweep


@shared_task(ignore_result=True)
def expire_matches():
    with match_lock():
        sweep()


@shared_task(ignore_result=True)
def clear_expired_sessions():
    Session.objects.filter(expire_date__lt=timezone.now()).delete()
