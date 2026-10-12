from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.access.models import EmergencyAccessRequest
from apps.hospitals.models import Hospital, HospitalMembership
from apps.users.models import UserProfile
from apps.users.permissions import get_request_profile

from .models import EmergencyDispute
from .serializers import CreateDisputeSerializer, EmergencyDisputeSerializer, ResolveDisputeSerializer


def hospital_admin(request, hospital):
    profile = get_request_profile(request)
    return bool(profile and HospitalMembership.objects.filter(hospital=hospital, user=profile, role=HospitalMembership.ROLE_ADMIN, active=True).exists())


class HospitalEmergencyAuditView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, hospital_id):
        hospital = Hospital.objects.filter(id=hospital_id, status=Hospital.STATUS_ACTIVE).first()
        if not hospital_admin(request, hospital):
            return Response({"detail": "Hospital admin access required"}, status=status.HTTP_403_FORBIDDEN)
        requests = EmergencyAccessRequest.objects.filter(hospital=hospital).select_related("patient", "doctor").prefetch_related("disputes").order_by("-requested_at")
        return Response([
            {
                "request_id": str(item.id),
                "patient_wallet": item.patient.wallet,
                "doctor_wallet": item.doctor.wallet,
                "context": item.context,
                "reason": item.reason,
                "predicate": item.predicate,
                "requested_resources": item.requested_resources,
                "status": item.status,
                "requested_at": item.requested_at,
                "dispute_count": item.disputes.count(),
                "disputes": [
                    {"id": dispute.id, "status": dispute.status, "reason": dispute.reason}
                    for dispute in item.disputes.all()
                ],
            }
            for item in requests
        ])


class CreateEmergencyDisputeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CreateDisputeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = get_request_profile(request)
        emergency_request = EmergencyAccessRequest.objects.filter(id=serializer.validated_data["request_id"], patient=profile).first()
        if not emergency_request:
            return Response({"detail": "Emergency request not found"}, status=status.HTTP_404_NOT_FOUND)
        dispute = EmergencyDispute.objects.create(
            request=emergency_request,
            reported_by=profile,
            reason=serializer.validated_data["reason"],
        )
        return Response(EmergencyDisputeSerializer(dispute).data, status=status.HTTP_201_CREATED)


class HospitalDisputeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, hospital_id, dispute_id):
        hospital = Hospital.objects.filter(id=hospital_id, status=Hospital.STATUS_ACTIVE).first()
        if not hospital_admin(request, hospital):
            return Response({"detail": "Hospital admin access required"}, status=status.HTTP_403_FORBIDDEN)
        dispute = EmergencyDispute.objects.filter(id=dispute_id, request__hospital=hospital).first()
        if not dispute:
            return Response({"detail": "Dispute not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = ResolveDisputeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dispute.status = serializer.validated_data["status"]
        dispute.resolution = serializer.validated_data.get("resolution", "")
        dispute.save(update_fields=["status", "resolution", "updated_at"])
        return Response(EmergencyDisputeSerializer(dispute).data)