from rest_framework import serializers

from .models import AccessRequest, Appointment, EmergencyAccessGrant, EmergencyAccessRequest, EmergencyApproval


class AccessRequestSerializer(serializers.ModelSerializer):
    patient_wallet = serializers.CharField(source="patient.wallet", read_only=True)
    doctor_wallet = serializers.CharField(source="doctor.wallet", read_only=True)
    record_id = serializers.IntegerField(source="record.record_id", read_only=True)

    class Meta:
        model = AccessRequest
        fields = (
            "id",
            "record_id",
            "patient_wallet",
            "doctor_wallet",
            "status",
            "requested_at",
            "approved_at",
            "rejected_at",
            "revoked_at",
            "request_tx_hash",
            "decision_tx_hash",
        )


class CreateAccessRequestSerializer(serializers.Serializer):
    record_id = serializers.IntegerField(min_value=0)
    patient_wallet = serializers.CharField(max_length=42)
    request_tx_hash = serializers.CharField(required=False, allow_blank=True, max_length=66)


class DecisionSerializer(serializers.Serializer):
    decision_tx_hash = serializers.CharField(required=False, allow_blank=True, max_length=66)


class EmergencyAccessRequestSerializer(serializers.ModelSerializer):
    patient_wallet = serializers.CharField(source="patient.wallet", read_only=True)
    doctor_wallet = serializers.CharField(source="doctor.wallet", read_only=True)
    record_id = serializers.IntegerField(source="record.record_id", read_only=True)

    class Meta:
        model = EmergencyAccessRequest
        fields = (
            "id",
            "record_id",
            "patient_wallet",
            "doctor_wallet",
            "context",
            "reason",
            "requested_resources",
            "status",
            "requested_at",
            "approved_at",
            "expires_at",
            "request_tx_hash",
        )


class CreateEmergencyAccessRequestSerializer(serializers.Serializer):
    record_id = serializers.IntegerField(min_value=0)
    patient_wallet = serializers.CharField(max_length=42)
    context = serializers.ChoiceField(choices=[choice[0] for choice in EmergencyAccessRequest.CONTEXT_CHOICES])
    reason = serializers.CharField(min_length=10)
    requested_resources = serializers.ListField(
        child=serializers.CharField(max_length=64),
        allow_empty=False,
    )
    request_tx_hash = serializers.CharField(required=False, allow_blank=True, max_length=66)


class EmergencyAccessGrantSerializer(serializers.ModelSerializer):
    request_id = serializers.UUIDField(source="request.id", read_only=True)
    record_id = serializers.IntegerField(source="request.record.record_id", read_only=True)

    class Meta:
        model = EmergencyAccessGrant
        fields = ("request_id", "record_id", "resources", "issued_at", "expires_at", "revoked_at")


class EmergencyApprovalSerializer(serializers.ModelSerializer):
    approver_wallet = serializers.CharField(source="approver.wallet", read_only=True)

    class Meta:
        model = EmergencyApproval
        fields = ("id", "approver_wallet", "decision", "decided_at")


class AppointmentSerializer(serializers.ModelSerializer):
    patient_wallet = serializers.CharField(source="patient.wallet", read_only=True)
    doctor_wallet = serializers.CharField(source="doctor.wallet", read_only=True)
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    doctor_name = serializers.CharField(source="doctor.full_name", read_only=True)

    class Meta:
        model = Appointment
        fields = ("id", "patient_wallet", "doctor_wallet", "patient_name", "doctor_name", "scheduled_for", "reason", "status", "created_at", "updated_at")


class CreateAppointmentSerializer(serializers.Serializer):
    doctor_wallet = serializers.CharField(max_length=42)
    scheduled_for = serializers.DateTimeField()
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)


class AppointmentStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[Appointment.STATUS_CONFIRMED, Appointment.STATUS_REJECTED, Appointment.STATUS_CANCELLED])
