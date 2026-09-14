from django.contrib import admin

from .models import MatchPreferences, Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ["alias", "avatar_id", "updated_at"]
    search_fields = ["alias", "id"]
    readonly_fields = ["id", "user", "alias", "updated_at"]


@admin.register(MatchPreferences)
class PreferenceAdmin(admin.ModelAdmin):
    readonly_fields = ["user"]


# PrivateProfile deliberately has no general-purpose admin screen.
