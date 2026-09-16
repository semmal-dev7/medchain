from django.db import models


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
