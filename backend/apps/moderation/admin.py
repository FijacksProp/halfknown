from django.contrib import admin
from django.core.exceptions import ValidationError

from .models import Block, Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("id", "reason", "status", "created_at")
    list_filter = ("status", "reason")
    readonly_fields = ("conversation", "reporter", "reported", "reason", "details", "evidence", "created_at")
    fields = (*readonly_fields, "status", "review_notes")

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)

        class ReviewForm(form):
            def clean(self):
                data = super().clean()
                if data.get("status") == "resolved" and not data.get("review_notes", "").strip():
                    raise ValidationError("Add a review rationale before resolving a report.")
                return data

        return ReviewForm

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Block)
class BlockAdmin(admin.ModelAdmin):
    list_display = ("id", "created_at")
    readonly_fields = ("blocker", "blocked", "created_at")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
