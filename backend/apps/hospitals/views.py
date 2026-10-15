from django.utils import timezone
from django.db import transaction
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import UserProfile
from apps.users.permissions import IsActiveAdmin, get_request_profile

from .models import Hospital, HospitalDoctorRequest, HospitalEmergencyPolicy, HospitalMembership, HospitalPatientProfile
from .permissions import IsHospitalAdmin
from .serializers import (
    CreateHospitalSerializer,
    CreateDoctorHospitalRequestSerializer,
    DoctorHospitalRequestSerializer,
    EmergencyPolicySerializer,
    HospitalPatientProfileSerializer,
    HospitalSerializer,
    HospitalMembershipSerializer,
    RegisterDoctorSerializer,
    RegisterHospitalPatientSerializer,
)

DEFAULT_EMERGENCY_PREDICATES = [
    "critical_drug_allergy",
    "anticoagulant_use",
    "critical_medication",
    "blood_group",
    "emergency_contraindication",
    "critical_condition",
]


class HospitalListCreateView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        hospitals = Hospital.objects.filter(status=Hospital.STATUS_ACTIVE).order_by("name")
        return Response([
            {"id": str(hospital.id), "name": hospital.name, "wallet": hospital.wallet, "status": hospital.status}
            for hospital in hospitals
        ])

    def post(self, request):
        if not IsActiveAdmin().has_permission(request, self):
            return Response({"detail": "Only active platform admins can register hospitals"}, status=status.HTTP_403_FORBIDDEN)

        serializer = CreateHospitalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = get_request_profile(request)
        hospital, created = Hospital.objects.get_or_create(
            wallet=serializer.validated_data["wallet"],
            defaults={"name": serializer.validated_data["name"], "registered_by": profile},
        )
        if not created:
            return Response({"detail": "A hospital is already registered for this wallet"}, status=status.HTTP_409_CONFLICT)

        HospitalMembership.objects.create(
            hospital=hospital,
            user=profile,
            role=HospitalMembership.ROLE_ADMIN,
        )
        HospitalEmergencyPolicy.objects.create(hospital=hospital, allowed_predicates=DEFAULT_EMERGENCY_PREDICATES)
        return Response(HospitalSerializer(hospital).data, status=status.HTTP_201_CREATED)


class HospitalAdminListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = get_request_profile(request)
        hospitals = Hospital.objects.filter(
            status=Hospital.STATUS_ACTIVE,
            memberships__user=profile,
            memberships__role=HospitalMembership.ROLE_ADMIN,
            memberships__active=True,
        ).distinct().order_by("name")
        return Response([
            {"id": str(hospital.id), "name": hospital.name, "wallet": hospital.wallet, "status": hospital.status}
            for hospital in hospitals
        ])


class HospitalDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_hospital(self, hospital_id):
        return Hospital.objects.filter(id=hospital_id, status=Hospital.STATUS_ACTIVE).prefetch_related("memberships__user").first()

    def get(self, request, hospital_id):
        hospital = self.get_hospital(hospital_id)
        if not hospital:
            return Response({"detail": "Hospital not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(HospitalSerializer(hospital).data)


class HospitalPublicAuditView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, hospital_id):
        hospital = Hospital.objects.filter(id=hospital_id, status=Hospital.STATUS_ACTIVE).first()
        if not hospital:
            return Response({"detail": "Hospital not found"}, status=status.HTTP_404_NOT_FOUND)
        members = HospitalMembership.objects.filter(
            hospital=hospital,
            user__role=UserProfile.ROLE_DOCTOR,
        ).select_related("user").order_by("user__full_name", "user__wallet")
        return Response({
            "hospital": {"id": str(hospital.id), "name": hospital.name, "wallet": hospital.wallet, "status": hospital.status},
            "doctors": [
                {
                    "wallet": member.user.wallet,
                    "name": member.user.full_name,
                    "role": member.role,
                    "active": member.active,
                }
                for member in members
            ],
        })


class HospitalDoctorRegistrationView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsHospitalAdmin]

    def get(self, request, hospital_id):
        hospital = Hospital.objects.filter(id=hospital_id, status=Hospital.STATUS_ACTIVE).first()
        self.hospital = hospital
        if not hospital or not IsHospitalAdmin().has_permission(request, self):
            return Response({"detail": "Hospital not found or admin access required"}, status=status.HTTP_403_FORBIDDEN)
        memberships = HospitalMembership.objects.filter(
            hospital=hospital,
            user__role=UserProfile.ROLE_DOCTOR,
        ).select_related("user").order_by("user__full_name", "user__wallet")
        return Response(HospitalMembershipSerializer(memberships, many=True).data)

    @transaction.atomic
    def post(self, request, hospital_id):
        hospital = Hospital.objects.select_for_update().filter(id=hospital_id, status=Hospital.STATUS_ACTIVE).first()
        self.hospital = hospital
        if not hospital or not IsHospitalAdmin().has_permission(request, self):
            return Response({"detail": "Hospital not found or admin access required"}, status=status.HTTP_403_FORBIDDEN)

        serializer = RegisterDoctorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if serializer.validated_data["role"] == HospitalMembership.ROLE_EMERGENCY_DOCTOR:
            if not serializer.validated_data["emergency_access"]:
                return Response({"detail": "Emergency doctors must have emergency access enabled."}, status=status.HTTP_400_BAD_REQUEST)
        doctor = UserProfile.objects.get(wallet=serializer.validated_data["doctor_wallet"])
        existing = HospitalMembership.objects.filter(hospital=hospital, user=doctor).first()
        if existing:
            return Response({"detail": "Doctor is already affiliated with this hospital"}, status=status.HTTP_409_CONFLICT)

        membership = HospitalMembership.objects.create(
            hospital=hospital,
            user=doctor,
            role=serializer.validated_data["role"],
            emergency_access=serializer.validated_data["emergency_access"],
        )
        return Response({"wallet": membership.user.wallet, "hospital_id": str(hospital.id), "role": membership.role, "emergency_access": membership.emergency_access}, status=status.HTTP_201_CREATED)


class CreateDoctorHospitalRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        doctor = get_request_profile(request)
        if not doctor or doctor.role != UserProfile.ROLE_DOCTOR or doctor.status not in (UserProfile.STATUS_PENDING, UserProfile.STATUS_ACTIVE):
            return Response({"detail": "A pending or active doctor account is required"}, status=status.HTTP_403_FORBIDDEN)
        serializer = CreateDoctorHospitalRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        hospital = Hospital.objects.get(wallet=serializer.validated_data["hospital_wallet"])
        if HospitalMembership.objects.filter(hospital=hospital, user=doctor, active=True).exists():
            return Response({"detail": "Doctor is already active at this hospital"}, status=status.HTTP_409_CONFLICT)
        request_obj, created = HospitalDoctorRequest.objects.get_or_create(
            hospital=hospital,
            doctor=doctor,
            status=HospitalDoctorRequest.STATUS_PENDING,
            defaults={
                "requested_role": serializer.validated_data["requested_role"],
                "reason": serializer.validated_data.get("reason", ""),
            },
        )
        if not created:
            return Response({"detail": "A pending hospital request already exists"}, status=status.HTTP_409_CONFLICT)
        return Response(DoctorHospitalRequestSerializer(request_obj).data, status=status.HTTP_201_CREATED)


class DoctorHospitalRequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        doctor = get_request_profile(request)
        requests = HospitalDoctorRequest.objects.filter(doctor=doctor).select_related("hospital").order_by("-requested_at")
        return Response(DoctorHospitalRequestSerializer(requests, many=True).data)


class HospitalDoctorRequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsHospitalAdmin]

    def get(self, request, hospital_id):
        hospital = Hospital.objects.filter(id=hospital_id, status=Hospital.STATUS_ACTIVE).first()
        self.hospital = hospital
        if not hospital or not IsHospitalAdmin().has_permission(request, self):
            return Response({"detail": "Hospital admin access required"}, status=status.HTTP_403_FORBIDDEN)
        requests = HospitalDoctorRequest.objects.filter(hospital=hospital).select_related("doctor").order_by("-requested_at")
        return Response(DoctorHospitalRequestSerializer(requests, many=True).data)


class ReviewHospitalDoctorRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsHospitalAdmin]

    @transaction.atomic
    def post(self, request, hospital_id, request_id, decision):
        hospital = Hospital.objects.select_for_update().filter(id=hospital_id, status=Hospital.STATUS_ACTIVE).first()
        self.hospital = hospital
        if not hospital or not IsHospitalAdmin().has_permission(request, self):
            return Response({"detail": "Hospital admin access required"}, status=status.HTTP_403_FORBIDDEN)
        if decision not in ("approve", "reject"):
            return Response({"detail": "Unsupported decision"}, status=status.HTTP_400_BAD_REQUEST)
        request_obj = HospitalDoctorRequest.objects.filter(id=request_id, hospital=hospital, status=HospitalDoctorRequest.STATUS_PENDING).first()
        if not request_obj:
            return Response({"detail": "Pending doctor request not found"}, status=status.HTTP_404_NOT_FOUND)
        reviewer = get_request_profile(request)
        request_obj.status = HospitalDoctorRequest.STATUS_APPROVED if decision == "approve" else HospitalDoctorRequest.STATUS_REJECTED
        request_obj.reviewed_at = timezone.now()
        request_obj.reviewed_by = reviewer
        request_obj.save(update_fields=["status", "reviewed_at", "reviewed_by"])
        if request_obj.status == HospitalDoctorRequest.STATUS_APPROVED:
            request_obj.doctor.status = UserProfile.STATUS_ACTIVE
            request_obj.doctor.save(update_fields=["status", "updated_at"])
            HospitalMembership.objects.update_or_create(
                hospital=hospital,
                user=request_obj.doctor,
                defaults={
                    "role": request_obj.requested_role,
                    "active": True,
                    "emergency_access": request_obj.requested_role == HospitalMembership.ROLE_EMERGENCY_DOCTOR,
                },
            )
        return Response(DoctorHospitalRequestSerializer(request_obj).data)


class HospitalDoctorDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsHospitalAdmin]

    def get_hospital(self, hospital_id):
        return Hospital.objects.filter(id=hospital_id, status=Hospital.STATUS_ACTIVE).first()

    @transaction.atomic
    def patch(self, request, hospital_id, doctor_wallet):
        hospital = Hospital.objects.select_for_update().filter(id=hospital_id, status=Hospital.STATUS_ACTIVE).first()
        self.hospital = hospital
        if not hospital:
            return Response({"detail": "Hospital not found"}, status=status.HTTP_404_NOT_FOUND)
        membership = HospitalMembership.objects.filter(hospital=hospital, user_id=doctor_wallet.lower()).first()
        if not membership:
            return Response({"detail": "Hospital member not found"}, status=status.HTTP_404_NOT_FOUND)
        if "role" in request.data and request.data["role"] not in dict(HospitalMembership.ROLE_CHOICES):
            return Response({"detail": "Unsupported hospital role"}, status=status.HTTP_400_BAD_REQUEST)
        if "emergency_access" in request.data and not isinstance(request.data["emergency_access"], bool):
            return Response({"detail": "emergency_access must be a boolean"}, status=status.HTTP_400_BAD_REQUEST)
        if "active" in request.data and not isinstance(request.data["active"], bool):
            return Response({"detail": "active must be a boolean"}, status=status.HTTP_400_BAD_REQUEST)
        if "active" in request.data:
            membership.active = request.data["active"]
        if "emergency_access" in request.data:
            membership.emergency_access = request.data["emergency_access"]
        if "role" in request.data:
            membership.role = request.data["role"]
        membership.save(update_fields=["active", "emergency_access", "role"])
        return Response(HospitalMembershipSerializer(membership).data)

    @transaction.atomic
    def delete(self, request, hospital_id, doctor_wallet):
        hospital = Hospital.objects.select_for_update().filter(id=hospital_id, status=Hospital.STATUS_ACTIVE).first()
        self.hospital = hospital
        if not hospital:
            return Response({"detail": "Hospital not found"}, status=status.HTTP_404_NOT_FOUND)
        membership = HospitalMembership.objects.filter(hospital=hospital, user_id=doctor_wallet.lower()).first()
        if not membership:
            return Response({"detail": "Hospital member not found"}, status=status.HTTP_404_NOT_FOUND)
        membership.active = False
        membership.emergency_access = False
        membership.save(update_fields=["active", "emergency_access"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class HospitalPolicyView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsHospitalAdmin]

    def get_hospital(self, hospital_id):
        return Hospital.objects.filter(id=hospital_id, status=Hospital.STATUS_ACTIVE).first()

    def get(self, request, hospital_id):
        hospital = self.get_hospital(hospital_id)
        if not hospital:
            return Response({"detail": "Hospital not found"}, status=status.HTTP_404_NOT_FOUND)
        policy, _ = HospitalEmergencyPolicy.objects.get_or_create(hospital=hospital, defaults={"allowed_predicates": DEFAULT_EMERGENCY_PREDICATES})
        return Response(EmergencyPolicySerializer(policy).data)

    def put(self, request, hospital_id):
        hospital = self.get_hospital(hospital_id)
        self.hospital = hospital
        if not hospital or not IsHospitalAdmin().has_permission(request, self):
            return Response({"detail": "Hospital admin access required"}, status=status.HTTP_403_FORBIDDEN)
        predicates = request.data.get("allowed_predicates")
        if not isinstance(predicates, list) or not predicates or any(not isinstance(item, str) for item in predicates):
            return Response({"detail": "allowed_predicates must be a non-empty list of strings"}, status=status.HTTP_400_BAD_REQUEST)
        policy, _ = HospitalEmergencyPolicy.objects.update_or_create(hospital=hospital, defaults={"allowed_predicates": predicates})
        return Response(EmergencyPolicySerializer(policy).data)


class HospitalPatientProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsHospitalAdmin]

    def post(self, request, hospital_id):
        hospital = Hospital.objects.filter(id=hospital_id, status=Hospital.STATUS_ACTIVE).first()
        self.hospital = hospital
        if not hospital or not IsHospitalAdmin().has_permission(request, self):
            return Response({"detail": "Hospital admin access required"}, status=status.HTTP_403_FORBIDDEN)
        serializer = RegisterHospitalPatientSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        patient = UserProfile.objects.filter(wallet=serializer.validated_data["patient_wallet"].lower(), role=UserProfile.ROLE_PATIENT).first()
        if not patient:
            return Response({"detail": "Registered patient not found"}, status=status.HTTP_404_NOT_FOUND)
        profile, created = HospitalPatientProfile.objects.get_or_create(
            hospital=hospital,
            patient=patient,
            defaults={
                "hospital_patient_id": serializer.validated_data["hospital_patient_id"],
                "administrative_notes": serializer.validated_data.get("administrative_notes", ""),
            },
        )
        if not created:
            return Response({"detail": "Patient already has a profile at this hospital"}, status=status.HTTP_409_CONFLICT)
        return Response(HospitalPatientProfileSerializer(profile).data, status=status.HTTP_201_CREATED)