from django.contrib import admin

from .models import ChainSyncState


@admin.register(ChainSyncState)
class ChainSyncStateAdmin(admin.ModelAdmin):
    list_display = ("id", "last_processed_block", "updated_at")
