from django.contrib import admin

from .models import AuthNonce


@admin.register(AuthNonce)
class AuthNonceAdmin(admin.ModelAdmin):
    list_display = ("wallet", "expires_at", "created_at")
    search_fields = ("wallet",)
