from django.contrib import admin

from .models import AccessRequest


@admin.register(AccessRequest)
class AccessRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "record", "patient", "doctor", "status", "requested_at")
    list_filter = ("status",)
    search_fields = ("patient__wallet", "doctor__wallet", "record__record_id")
