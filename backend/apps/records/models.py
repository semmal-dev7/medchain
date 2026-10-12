from django.db import models

from apps.users.models import UserProfile


class Record(models.Model):
    record_id = models.BigIntegerField(unique=True)
    patient = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="records")
    ipfs_hash = models.TextField()
    encrypted_key_ref = models.TextField()
    uploaded_file = models.FileField(upload_to="medical_records/", null=True, blank=True)
    encrypted_file = models.FileField(upload_to="encrypted_medical_records/", null=True, blank=True)
    original_file_name = models.CharField(max_length=255, blank=True, default="")
    fhir_bundle = models.JSONField(default=dict, blank=True)
    clinical_commitment = models.CharField(max_length=66, blank=True, default="")
    commitment_algorithm = models.CharField(max_length=32, default="sha256-v1")
    name = models.CharField(max_length=200, blank=True, default="")
    description = models.TextField(blank=True, default="")
    active = models.BooleanField(default=True)
    tx_hash = models.CharField(max_length=66)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["patient"]),
            models.Index(fields=["-created_at"]),
        ]

    def __str__(self):
        return f"record:{self.record_id} owner:{self.patient_id}"
