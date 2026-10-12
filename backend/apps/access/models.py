import uuid

from django.db import models

from apps.records.models import Record
from apps.hospitals.models import Hospital
from apps.users.models import UserProfile


class AccessRequest(models.Model):
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_REVOKED = "revoked"
    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_REVOKED, "Revoked"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    record = models.ForeignKey(Record, on_delete=models.CASCADE, related_name="access_requests")
    patient = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="incoming_requests")
    doctor = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="doctor_requests")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    requested_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    request_tx_hash = models.CharField(max_length=66, blank=True, default="")
    decision_tx_hash = models.CharField(max_length=66, blank=True, default="")

    class Meta:
        indexes = [
            models.Index(fields=["patient", "status"]),
            models.Index(fields=["doctor", "status"]),
        ]

    def __str__(self):
        return f"{self.id} {self.status}"


class EmergencyAccessRequest(models.Model):
    CONTEXT_CHOICES = (
        ("road_accident", "Road accident"),
        ("cardiac_event", "Cardiac event"),
        ("critical_condition", "Critical condition"),
        ("other", "Other"),
    )
    STATUS_REQUESTED = "requested"
    STATUS_CONTEXT_VERIFIED = "context_verified"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_EXPIRED = "expired"
    STATUS_CHOICES = (
        (STATUS_REQUESTED, "Requested"),
        (STATUS_CONTEXT_VERIFIED, "Context verified"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_EXPIRED, "Expired"),
    )
    DEFAULT_RESOURCES = ["Patient", "Condition", "AllergyIntolerance", "MedicationStatement"]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    record = models.ForeignKey(Record, on_delete=models.CASCADE, related_name="emergency_requests")
    patient = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="emergency_requests_received")
    doctor = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="emergency_requests_created")
    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, null=True, blank=True, related_name="emergency_requests")
    context = models.CharField(max_length=32, choices=CONTEXT_CHOICES)
    reason = models.TextField()
    requested_resources = models.JSONField(default=list)
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default=STATUS_REQUESTED)
    requested_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    request_tx_hash = models.CharField(max_length=66, blank=True, default="")
    predicate = models.CharField(max_length=64, blank=True, default="")

    class Meta:
        indexes = [
            models.Index(fields=["patient", "status"]),
            models.Index(fields=["doctor", "status"]),
        ]

    def __str__(self):
        return f"emergency:{self.id} {self.status}"


class EmergencyAccessGrant(models.Model):
    request = models.OneToOneField(EmergencyAccessRequest, on_delete=models.CASCADE, related_name="temporary_grant")
    token_digest = models.CharField(max_length=64, unique=True)
    resources = models.JSONField(default=list)
    issued_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"grant:{self.request_id} expires:{self.expires_at.isoformat()}"


class EmergencyApproval(models.Model):
    DECISION_APPROVED = "approved"
    DECISION_REJECTED = "rejected"
    DECISION_CHOICES = (
        (DECISION_APPROVED, "Approved"),
        (DECISION_REJECTED, "Rejected"),
    )

    request = models.ForeignKey(EmergencyAccessRequest, on_delete=models.CASCADE, related_name="approvals")
    approver = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="emergency_approvals")
    decision = models.CharField(max_length=16, choices=DECISION_CHOICES)
    decided_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["request", "approver"], name="unique_emergency_request_approver"),
        ]

    def __str__(self):
        return f"approval:{self.request_id}:{self.approver_id}:{self.decision}"


class Appointment(models.Model):
    STATUS_REQUESTED = "requested"
    STATUS_CONFIRMED = "confirmed"
    STATUS_REJECTED = "rejected"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = (
        (STATUS_REQUESTED, "Requested"),
        (STATUS_CONFIRMED, "Confirmed"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_CANCELLED, "Cancelled"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="patient_appointments")
    doctor = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="doctor_appointments")
    scheduled_for = models.DateTimeField()
    reason = models.TextField(blank=True, default="")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_REQUESTED)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["scheduled_for"]

    def __str__(self):
        return f"appointment:{self.id} {self.status}"
