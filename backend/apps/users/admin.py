from django.contrib import admin

from .models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("wallet", "role", "status", "created_at")
    list_filter = ("role", "status")
    search_fields = ("wallet", "full_name")
