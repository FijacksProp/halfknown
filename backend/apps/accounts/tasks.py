from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail


@shared_task(ignore_result=True)
def send_login_code(email, code):
    send_mail(
        "Your Halfknown sign-in code",
        f"Your code is {code}. It expires in 10 minutes.\n\n"
        "Never share this code. If you did not request it, ignore this email.",
        settings.DEFAULT_FROM_EMAIL,
        [email],
        fail_silently=False,
    )
