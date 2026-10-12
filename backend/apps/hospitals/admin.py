from django.contrib import admin

from .models import Hospital, HospitalMembership


@admin.register(Hospital)
class HospitalAdmin(admin.ModelAdmin):
    list_display = ("name", "wallet", "status", "created_at")
    search_fields = ("name", "wallet")


@admin.register(HospitalMembership)
class HospitalMembershipAdmin(admin.ModelAdmin):
    list_display = ("hospital", "user", "role", "active")
    list_filter = ("role", "active")