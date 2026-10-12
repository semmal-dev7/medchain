from rest_framework import serializers

from .models import EmergencyDispute


class EmergencyDisputeSerializer(serializers.ModelSerializer):
    request_id = serializers.UUIDField(source="request.id", read_only=True)
    patient_wallet = serializers.CharField(source="request.patient.wallet", read_only=True)
    doctor_wallet = serializers.CharField(source="request.doctor.wallet", read_only=True)
    hospital_name = serializers.CharField(source="request.hospital.name", read_only=True)
    predicate = serializers.CharField(source="request.predicate", read_only=True)

    class Meta:
        model = EmergencyDispute
        fields = (
            "id", "request_id", "patient_wallet", "doctor_wallet", "hospital_name",
            "predicate", "reason", "status", "resolution", "created_at", "updated_at",
        )


class CreateDisputeSerializer(serializers.Serializer):
    request_id = serializers.UUIDField()
    reason = serializers.CharField(min_length=10)


class ResolveDisputeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[EmergencyDispute.STATUS_INVESTIGATING, EmergencyDispute.STATUS_RESOLVED])
    resolution = serializers.CharField(required=False, allow_blank=True)