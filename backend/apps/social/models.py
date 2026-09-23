import uuid

from django.conf import settings
from django.db import models


class Follow(models.Model):
    follower = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="following")
    followed = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="followers")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["follower", "followed"], name="unique_social_follow"),
            models.CheckConstraint(condition=~models.Q(follower=models.F("followed")), name="no_self_follow"),
        ]


class Connection(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="connections_first"
    )
    second = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="connections_second"
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="requests_sent"
    )
    status = models.CharField(
        max_length=12,
        choices=[("pending", "Pending"), ("accepted", "Accepted"), ("declined", "Declined")],
    )
    first_read_at = models.DateTimeField(null=True, blank=True)
    second_read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["first", "second"], name="unique_social_connection"),
            models.CheckConstraint(condition=~models.Q(first=models.F("second")), name="no_self_connection"),
        ]


class DirectMessage(models.Model):
    connection = models.ForeignKey(Connection, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    body = models.CharField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["connection", "id"])]


class ShowcaseItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="showcase")
    kind = models.CharField(
        max_length=16, choices=[("talent", "Talent"), ("project", "Project"), ("interest", "Interest")]
    )
    title = models.CharField(max_length=80)
    description = models.CharField(max_length=300)
    created_at = models.DateTimeField(auto_now_add=True)


class SocialReport(models.Model):
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="social_reports_made"
    )
    reported = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="social_reports_received"
    )
    reason = models.CharField(max_length=24)
    details = models.CharField(max_length=2000, blank=True)
    evidence = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=16,
        choices=[("new", "New"), ("reviewing", "Reviewing"), ("resolved", "Resolved")],
        default="new",
    )
