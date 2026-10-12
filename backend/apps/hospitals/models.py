import uuid

from django.db import models

from apps.users.models import UserProfile


class Hospital(models.Model):
    STATUS_ACTIVE = "active"
    STATUS_SUSPENDED = "suspended"
    STATUS_CHOICES = (
        (STATUS_ACTIVE, "Active"),
        (STATUS_SUSPENDED, "Suspended"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    wallet = models.CharField(max_length=42, unique=True)
    name = models.CharField(max_length=200)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    registered_by = models.ForeignKey(UserProfile, on_delete=models.PROTECT, related_name="hospitals_registered")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.wallet})"


class HospitalMembership(models.Model):
    ROLE_ADMIN = "admin"
    ROLE_DOCTOR = "doctor"
    ROLE_EMERGENCY_DOCTOR = "emergency_doctor"
    ROLE_STAFF = "staff"
    ROLE_CHOICES = (
        (ROLE_ADMIN, "Hospital admin"),
        (ROLE_DOCTOR, "Doctor"),
        (ROLE_EMERGENCY_DOCTOR, "Emergency doctor"),
        (ROLE_STAFF, "Authorized staff"),
    )

    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="hospital_memberships")
    role = models.CharField(max_length=16, choices=ROLE_CHOICES)
    active = models.BooleanField(default=True)
    emergency_access = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["hospital", "user"], name="unique_hospital_membership"),
        ]

    def __str__(self):
        return f"{self.hospital_id}:{self.user_id} ({self.role})"


class HospitalDoctorRequest(models.Model):
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name="doctor_requests")
    doctor = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="hospital_doctor_requests")
    requested_role = models.CharField(max_length=16, choices=[
        (HospitalMembership.ROLE_DOCTOR, "Doctor"),
        (HospitalMembership.ROLE_EMERGENCY_DOCTOR, "Emergency doctor"),
    ])
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    reason = models.TextField(blank=True, default="")
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(UserProfile, on_delete=models.PROTECT, null=True, blank=True, related_name="hospital_requests_reviewed")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["hospital", "doctor"],
                condition=models.Q(status="pending"),
                name="unique_pending_hospital_doctor_request",
            ),
        ]


class HospitalEmergencyPolicy(models.Model):
    hospital = models.OneToOneField(Hospital, on_delete=models.CASCADE, related_name="emergency_policy")
    allowed_predicates = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"emergency-policy:{self.hospital_id}"


class HospitalPatientProfile(models.Model):
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name="patient_profiles")
    patient = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="hospital_profiles")
    hospital_patient_id = models.CharField(max_length=100)
    administrative_notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["hospital", "patient"], name="unique_hospital_patient"),
            models.UniqueConstraint(fields=["hospital", "hospital_patient_id"], name="unique_hospital_patient_id"),
        ]


class HospitalEncounter(models.Model):
    patient_profile = models.ForeignKey(HospitalPatientProfile, on_delete=models.CASCADE, related_name="encounters")
    created_by = models.ForeignKey(UserProfile, on_delete=models.PROTECT, related_name="hospital_encounters_created")
    encounter_type = models.CharField(max_length=100)
    status = models.CharField(max_length=32, default="planned")
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)