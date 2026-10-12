from rest_framework import serializers

from apps.users.models import UserProfile

from .models import Hospital, HospitalDoctorRequest, HospitalEmergencyPolicy, HospitalMembership, HospitalPatientProfile


class HospitalMembershipSerializer(serializers.ModelSerializer):
    wallet = serializers.CharField(source="user.wallet", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = HospitalMembership
        fields = ("wallet", "full_name", "role", "active", "emergency_access", "created_at")


class HospitalSerializer(serializers.ModelSerializer):
    members = HospitalMembershipSerializer(source="memberships", many=True, read_only=True)
    emergency_policy = serializers.SerializerMethodField()

    def get_emergency_policy(self, obj):
        try:
            policy = obj.emergency_policy
        except HospitalEmergencyPolicy.DoesNotExist:
            policy = None
        return policy.allowed_predicates if policy else []

    class Meta:
        model = Hospital
        fields = ("id", "wallet", "name", "status", "created_at", "members", "emergency_policy")


class CreateHospitalSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    wallet = serializers.CharField(max_length=42)

    def validate_wallet(self, value):
        wallet = value.lower()
        if not wallet.startswith("0x") or len(wallet) != 42:
            raise serializers.ValidationError("Enter a valid hospital wallet address")
        return wallet


class RegisterDoctorSerializer(serializers.Serializer):
    doctor_wallet = serializers.CharField(max_length=42)
    role = serializers.ChoiceField(
        choices=[
            HospitalMembership.ROLE_DOCTOR,
            HospitalMembership.ROLE_EMERGENCY_DOCTOR,
            HospitalMembership.ROLE_STAFF,
        ],
        default=HospitalMembership.ROLE_DOCTOR,
    )
    emergency_access = serializers.BooleanField(default=False)

    def validate_doctor_wallet(self, value):
        wallet = value.lower()
        doctor = UserProfile.objects.filter(wallet=wallet, role=UserProfile.ROLE_DOCTOR).first()
        if not doctor:
            raise serializers.ValidationError("Registered doctor not found")
        if doctor.status != UserProfile.STATUS_ACTIVE:
            raise serializers.ValidationError("Doctor is not active")
        return wallet


class DoctorHospitalRequestSerializer(serializers.ModelSerializer):
    doctor_wallet = serializers.CharField(source="doctor.wallet", read_only=True)
    doctor_name = serializers.CharField(source="doctor.full_name", read_only=True)
    hospital_name = serializers.CharField(source="hospital.name", read_only=True)
    hospital_wallet = serializers.CharField(source="hospital.wallet", read_only=True)

    class Meta:
        model = HospitalDoctorRequest
        fields = ("id", "doctor_wallet", "doctor_name", "hospital_name", "hospital_wallet", "requested_role", "status", "reason", "requested_at", "reviewed_at")


class CreateDoctorHospitalRequestSerializer(serializers.Serializer):
    hospital_wallet = serializers.CharField(max_length=42)
    requested_role = serializers.ChoiceField(choices=[HospitalMembership.ROLE_DOCTOR, HospitalMembership.ROLE_EMERGENCY_DOCTOR])
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)

    def validate_hospital_wallet(self, value):
        wallet = value.lower()
        if not Hospital.objects.filter(wallet=wallet, status=Hospital.STATUS_ACTIVE).exists():
            raise serializers.ValidationError("Active hospital not found for this wallet")
        return wallet


class EmergencyPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = HospitalEmergencyPolicy
        fields = ("allowed_predicates", "updated_at")


class HospitalPatientProfileSerializer(serializers.ModelSerializer):
    patient_wallet = serializers.CharField(source="patient.wallet", read_only=True)

    class Meta:
        model = HospitalPatientProfile
        fields = ("id", "patient_wallet", "hospital_patient_id", "administrative_notes", "created_at", "updated_at")


class RegisterHospitalPatientSerializer(serializers.Serializer):
    patient_wallet = serializers.CharField(max_length=42)
    hospital_patient_id = serializers.CharField(max_length=100)
    administrative_notes = serializers.CharField(required=False, allow_blank=True)