from django.contrib import admin

from .models import Record


@admin.register(Record)
class RecordAdmin(admin.ModelAdmin):
    list_display = ("record_id", "patient", "active", "created_at")
    search_fields = ("record_id", "patient__wallet", "ipfs_hash")
