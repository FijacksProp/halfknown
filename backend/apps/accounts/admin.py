from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class HalfknownUserAdmin(UserAdmin):
    ordering = ["email"]
    list_display = ["id", "email", "is_active", "is_staff", "email_verified_at"]
    search_fields = ["email", "id"]
    readonly_fields = ["id", "email_verified_at", "last_login", "date_joined"]
    fieldsets = (
        (None, {"fields": ("id", "email", "password")}),
        ("Access", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("email_verified_at", "last_login", "date_joined")}),
    )
    add_fieldsets = ((None, {"fields": ("email", "password1", "password2")}),)
