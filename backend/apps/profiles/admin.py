from django.contrib import admin
from django.utils.html import format_html

from .models import MatchPreferences, Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ["alias", "avatar_id", "photo_status", "discoverable", "updated_at"]
    list_filter = ["photo_status", "discoverable"]
    search_fields = ["alias", "id"]
    readonly_fields = ["id", "user", "alias", "photo_preview", "updated_at"]
    actions = ["approve_photos", "reject_photos"]

    @admin.display(description="Uploaded photo")
    def photo_preview(self, obj):
        if not obj.photo:
            return "No photo uploaded"
        return format_html(
            '<img src="/api/v1/social/profiles/{}/photo/" alt="Profile photo awaiting review" style="max-width:260px;max-height:260px;object-fit:cover" />',
            obj.pk,
        )

    @admin.action(description="Approve selected photos")
    def approve_photos(self, request, queryset):
        count = queryset.exclude(photo="").update(photo_status="approved")
        self.message_user(request, f"Approved {count} photo(s). Owners can now opt into Discover.")

    @admin.action(description="Reject selected photos")
    def reject_photos(self, request, queryset):
        count = queryset.update(photo_status="rejected", discoverable=False)
        self.message_user(request, f"Rejected {count} photo(s).")


@admin.register(MatchPreferences)
class PreferenceAdmin(admin.ModelAdmin):
    readonly_fields = ["user"]


# PrivateProfile deliberately has no general-purpose admin screen.
