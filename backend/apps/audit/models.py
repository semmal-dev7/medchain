from django.db import models

from apps.access.models import EmergencyAccessRequest
from apps.users.models import UserProfile


class AuditEvent(models.Model):
    event_type = models.CharField(max_length=64)
    actor_wallet = models.CharField(max_length=42, blank=True, default="")
    subject_wallet = models.CharField(max_length=42, blank=True, default="")
    record_id = models.BigIntegerField(null=True, blank=True)
    tx_hash = models.CharField(max_length=66)
    block_number = models.BigIntegerField()
    log_index = models.IntegerField()
    chain_id = models.IntegerField()
    payload = models.JSONField(default=dict, blank=True)
    emitted_at = models.DateTimeField()
    indexed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tx_hash", "log_index"], name="uniq_tx_log_index"),
        ]
        indexes = [
            models.Index(fields=["event_type"]),
            models.Index(fields=["record_id"]),
            models.Index(fields=["-emitted_at"]),
        ]

    def __str__(self):
        return f"{self.event_type} #{self.tx_hash}:{self.log_index}"


class EmergencyDispute(models.Model):
    STATUS_OPEN = "open"
    STATUS_INVESTIGATING = "investigating"
    STATUS_RESOLVED = "resolved"
    STATUS_CHOICES = (
        (STATUS_OPEN, "Open"),
        (STATUS_INVESTIGATING, "Investigating"),
        (STATUS_RESOLVED, "Resolved"),
    )

    request = models.ForeignKey(EmergencyAccessRequest, on_delete=models.PROTECT, related_name="disputes")
    reported_by = models.ForeignKey(UserProfile, on_delete=models.PROTECT, related_name="emergency_disputes")
    reason = models.TextField()
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default=STATUS_OPEN)
    resolution = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
