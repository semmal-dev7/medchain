from django.contrib import admin

from .models import AuditEvent


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("event_type", "record_id", "tx_hash", "block_number", "emitted_at")
    search_fields = ("event_type", "tx_hash", "actor_wallet", "subject_wallet")
