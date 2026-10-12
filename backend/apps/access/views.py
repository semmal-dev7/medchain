from django.http import FileResponse
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.chain.services import ChainService
from apps.records.models import Record
from apps.records.serializers import RecordSerializer
from apps.records.encryption import decrypt_file
from apps.hospitals.models import HospitalEmergencyPolicy, HospitalMembership
from apps.records.clinical import build_fhir_bundle, create_clinical_commitment
from apps.users.models import UserProfile
from apps.users.permissions import IsActiveDoctor, IsActiveEmergencyApprover, IsActivePatient, get_request_profile

from .emergency import issue_temporary_grant, validate_temporary_grant
from .models import AccessRequest, Appointment, EmergencyAccessRequest, EmergencyApproval
from .serializers import (
    AccessRequestSerializer,
    CreateAccessRequestSerializer,
    CreateEmergencyAccessRequestSerializer,
    ClinicalResourcesSerializer,
    DecisionSerializer,
    EmergencyAccessGrantSerializer,
    EmergencyApprovalSerializer,
    EmergencyAccessRequestSerializer,
    AppointmentSerializer,
    AppointmentStatusSerializer,
    CreateAppointmentSerializer,
)


class CreateAccessRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveDoctor]

    def post(self, request):
        serializer = CreateAccessRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        doctor = get_request_profile(request)
        patient = UserProfile.objects.filter(wallet=data["patient_wallet"].lower()).first()
        if not patient or patient.role != UserProfile.ROLE_PATIENT:
            return Response({"detail": "Patient not found"}, status=status.HTTP_404_NOT_FOUND)

        record = Record.objects.filter(record_id=data["record_id"], patient=patient).first()
        if not record:
            return Response({"detail": "Record not found"}, status=status.HTTP_404_NOT_FOUND)

        chain = ChainService()
        if not chain.assert_doctor_can_request(record.record_id, doctor.wallet):
            return Response({"detail": "Doctor cannot request this record"}, status=status.HTTP_403_FORBIDDEN)

        existing_pending = AccessRequest.objects.filter(
            record=record,
            doctor=doctor,
            status=AccessRequest.STATUS_PENDING,
        ).first()
        if existing_pending:
            return Response({"detail": "Pending request already exists"}, status=status.HTTP_409_CONFLICT)

        request_obj = AccessRequest.objects.create(
            record=record,
            patient=patient,
            doctor=doctor,
            status=AccessRequest.STATUS_PENDING,
            request_tx_hash=data.get("request_tx_hash", ""),
        )
        return Response(AccessRequestSerializer(request_obj).data, status=status.HTTP_201_CREATED)


class IncomingRequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActivePatient]

    def get(self, request):
        patient = get_request_profile(request)
        requests_qs = AccessRequest.objects.filter(patient=patient).order_by("-requested_at")
        return Response(AccessRequestSerializer(requests_qs, many=True).data)


class OutgoingRequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveDoctor]

    def get(self, request):
        doctor = get_request_profile(request)
        requests_qs = AccessRequest.objects.filter(doctor=doctor).order_by("-requested_at")
        return Response(AccessRequestSerializer(requests_qs, many=True).data)


class PatientAppointmentsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActivePatient]

    def get(self, request):
        patient = get_request_profile(request)
        return Response(AppointmentSerializer(Appointment.objects.filter(patient=patient), many=True).data)

    def post(self, request):
        serializer = CreateAppointmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        patient = get_request_profile(request)
        data = serializer.validated_data
        doctor = UserProfile.objects.filter(wallet=data["doctor_wallet"].lower(), role=UserProfile.ROLE_DOCTOR, status=UserProfile.STATUS_ACTIVE).first()
        if not doctor:
            return Response({"detail": "Active doctor not found"}, status=status.HTTP_404_NOT_FOUND)
        appointment = Appointment.objects.create(patient=patient, doctor=doctor, scheduled_for=data["scheduled_for"], reason=data.get("reason", ""))
        return Response(AppointmentSerializer(appointment).data, status=status.HTTP_201_CREATED)


class DoctorAppointmentsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveDoctor]

    def get(self, request):
        doctor = get_request_profile(request)
        return Response(AppointmentSerializer(Appointment.objects.filter(doctor=doctor), many=True).data)


class AppointmentStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, appointment_id):
        serializer = AppointmentStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        appointment = Appointment.objects.filter(id=appointment_id).first()
        profile = get_request_profile(request)
        if not appointment:
            return Response({"detail": "Appointment not found"}, status=status.HTTP_404_NOT_FOUND)
        if profile == appointment.doctor and serializer.validated_data["status"] in (Appointment.STATUS_CONFIRMED, Appointment.STATUS_REJECTED):
            pass
        elif profile == appointment.patient and serializer.validated_data["status"] == Appointment.STATUS_CANCELLED:
            pass
        else:
            return Response({"detail": "You cannot change this appointment"}, status=status.HTTP_403_FORBIDDEN)
        appointment.status = serializer.validated_data["status"]
        appointment.save(update_fields=["status", "updated_at"])
        return Response(AppointmentSerializer(appointment).data)


class AuthorizedRecordView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveDoctor]

    def get(self, request, record_id):
        doctor = get_request_profile(request)
        record = Record.objects.filter(record_id=record_id, active=True).first()
        if not record:
            return Response({"detail": "Record not found"}, status=status.HTTP_404_NOT_FOUND)
        approved = AccessRequest.objects.filter(
            record=record,
            doctor=doctor,
            status=AccessRequest.STATUS_APPROVED,
        ).exists()
        if not approved or not ChainService().assert_access_active(record.record_id, doctor.wallet):
            return Response({"detail": "Patient approval is required before viewing this record"}, status=status.HTTP_403_FORBIDDEN)
        return Response(RecordSerializer(record).data)


class DownloadAuthorizedRecordView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveDoctor]

    def get(self, request, record_id):
        return Response(
            {"detail": "Doctors can view approved record details but cannot download patient records"},
            status=status.HTTP_403_FORBIDDEN,
        )


class ViewAuthorizedRecordView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveDoctor]

    def get(self, request, record_id):
        doctor = get_request_profile(request)
        record = Record.objects.filter(record_id=record_id, active=True).first()
        approved = AccessRequest.objects.filter(
            record=record,
            doctor=doctor,
            status=AccessRequest.STATUS_APPROVED,
        ).exists() if record else False
        if not record or not approved or not ChainService().assert_access_active(record.record_id, doctor.wallet):
            return Response({"detail": "Patient approval is required before viewing this record"}, status=status.HTTP_403_FORBIDDEN)
        if record.encrypted_file:
            try:
                contents = decrypt_file(record.encrypted_file.open("rb").read())
            except Exception:
                return Response({"detail": "Stored medical file could not be decrypted"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return FileResponse(
                iter([contents]),
                content_type="application/pdf",
                as_attachment=False,
                filename=record.original_file_name or f"medical-record-{record.record_id}.pdf",
            )
        if not record.uploaded_file:
            return Response({"detail": "The medical file is not available for viewing"}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(
            record.uploaded_file.open("rb"),
            content_type="application/pdf",
            as_attachment=False,
            filename=record.uploaded_file.name.rsplit("/", 1)[-1],
        )


class UpdateAuthorizedRecordFhirView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveDoctor]

    def patch(self, request, record_id):
        doctor = get_request_profile(request)
        serializer = ClinicalResourcesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record = Record.objects.filter(record_id=record_id, active=True).first()
        approved = AccessRequest.objects.filter(record=record, doctor=doctor, status=AccessRequest.STATUS_APPROVED).exists() if record else False
        hospital_member = HospitalMembership.objects.filter(
            user=doctor,
            role__in=[HospitalMembership.ROLE_DOCTOR, HospitalMembership.ROLE_EMERGENCY_DOCTOR, HospitalMembership.ROLE_STAFF],
            active=True,
        ).exists()
        if not record or not approved or not hospital_member or not ChainService().assert_access_active(record.record_id, doctor.wallet):
            return Response({"detail": "Approved hospital access is required to update this record"}, status=status.HTTP_403_FORBIDDEN)
        try:
            bundle = build_fhir_bundle(serializer.validated_data["fhir_resources"], record.patient.wallet, record.record_id)
        except ValueError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        record.fhir_bundle = bundle
        record.clinical_commitment = create_clinical_commitment(bundle)
        record.commitment_algorithm = "sha256-v1"
        record.save(update_fields=["fhir_bundle", "clinical_commitment", "commitment_algorithm"])
        return Response(RecordSerializer(record).data)


class CreateEmergencyAccessRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveDoctor]

    def post(self, request):
        serializer = CreateEmergencyAccessRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        doctor = get_request_profile(request)
        patient = UserProfile.objects.filter(wallet=data["patient_wallet"].lower()).first()
        if not patient or patient.role != UserProfile.ROLE_PATIENT:
            return Response({"detail": "Patient not found"}, status=status.HTTP_404_NOT_FOUND)

        record = Record.objects.filter(record_id=data["record_id"], patient=patient, active=True).first()
        if not record:
            return Response({"detail": "Record not found"}, status=status.HTTP_404_NOT_FOUND)

        chain = ChainService()
        if not chain.assert_doctor_can_request(record.record_id, doctor.wallet):
            return Response({"detail": "Doctor cannot request this record"}, status=status.HTTP_403_FORBIDDEN)

        membership = HospitalMembership.objects.select_related("hospital").filter(
            user=doctor,
            role__in=[HospitalMembership.ROLE_DOCTOR, HospitalMembership.ROLE_EMERGENCY_DOCTOR],
            active=True,
            emergency_access=True,
            hospital__status="active",
        ).first()
        if not membership:
            return Response({"detail": "Doctor must belong to an active hospital"}, status=status.HTTP_403_FORBIDDEN)
        policy = HospitalEmergencyPolicy.objects.filter(hospital=membership.hospital).first()
        if policy and data.get("predicate") and data["predicate"] not in policy.allowed_predicates:
            return Response({"detail": "Requested emergency resources are outside the hospital policy"}, status=status.HTTP_403_FORBIDDEN)

        request_obj = EmergencyAccessRequest.objects.create(
            record=record,
            patient=patient,
            doctor=doctor,
            hospital=membership.hospital,
            context=data["context"],
            reason=data["reason"],
            requested_resources=data["requested_resources"],
            request_tx_hash=data.get("request_tx_hash", ""),
            predicate=data.get("predicate", ""),
        )
        return Response(EmergencyAccessRequestSerializer(request_obj).data, status=status.HTTP_201_CREATED)


class OutgoingEmergencyRequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveDoctor]

    def get(self, request):
        doctor = get_request_profile(request)
        requests_qs = EmergencyAccessRequest.objects.filter(doctor=doctor).order_by("-requested_at")
        return Response(EmergencyAccessRequestSerializer(requests_qs, many=True).data)


class IssueEmergencyGrantView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveDoctor]

    def post(self, request, request_id):
        doctor = get_request_profile(request)
        emergency_request = EmergencyAccessRequest.objects.filter(id=request_id, doctor=doctor).first()
        if not emergency_request:
            return Response({"detail": "Emergency request not found"}, status=status.HTTP_404_NOT_FOUND)
        if emergency_request.status != EmergencyAccessRequest.STATUS_APPROVED:
            return Response({"detail": "Emergency request is not approved"}, status=status.HTTP_409_CONFLICT)

        grant, token = issue_temporary_grant(emergency_request)
        response = EmergencyAccessGrantSerializer(grant).data
        response["grant_token"] = token
        return Response(response)


class ValidateEmergencyGrantView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveDoctor]

    def post(self, request):
        grant = validate_temporary_grant(request.data.get("grant_token", ""))
        doctor = get_request_profile(request)
        if not grant or grant.request.doctor_id != doctor.wallet:
            return Response({"detail": "Temporary access expired or invalid"}, status=status.HTTP_403_FORBIDDEN)
        return Response(EmergencyAccessGrantSerializer(grant).data)


class EmergencyDisclosureView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveDoctor]

    def post(self, request):
        grant = validate_temporary_grant(request.data.get("grant_token", ""))
        doctor = get_request_profile(request)
        if not grant or grant.request.doctor_id != doctor.wallet:
            return Response({"detail": "Temporary access expired or invalid"}, status=status.HTTP_403_FORBIDDEN)

        requested_type = request.data.get("resource_type")
        allowed_types = grant.resources
        if requested_type and requested_type not in allowed_types:
            return Response({"detail": "Resource is outside the approved minimum disclosure"}, status=status.HTTP_403_FORBIDDEN)

        record = grant.request.record
        resources = []
        for resource_type in ([requested_type] if requested_type else allowed_types):
            resource = {
                "resourceType": resource_type,
                "id": f"emergency-{record.record_id}-{resource_type.lower()}",
                "meta": {"security": [{"system": "urn:medchain", "code": "emergency-minimum-disclosure"}]},
            }
            if resource_type == "Patient":
                resource["subject"] = {"reference": f"Patient/{record.patient.wallet}"}
            else:
                resource["subject"] = {"reference": f"Patient/{record.patient.wallet}"}
                resource["derivedFrom"] = [{"reference": f"Record/{record.record_id}"}]
            resources.append(resource)

        return Response({
            "request_id": str(grant.request_id),
            "record_id": record.record_id,
            "expires_at": grant.expires_at,
            "resources": resources,
        })


class PendingEmergencyRequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveEmergencyApprover]

    def get(self, request):
        requests_qs = EmergencyAccessRequest.objects.filter(
            status__in=[EmergencyAccessRequest.STATUS_REQUESTED, EmergencyAccessRequest.STATUS_CONTEXT_VERIFIED]
        ).order_by("requested_at")
        return Response(EmergencyAccessRequestSerializer(requests_qs, many=True).data)


class ApproveEmergencyRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveEmergencyApprover]
    threshold = 2

    def post(self, request, request_id):
        approver = get_request_profile(request)
        emergency_request = EmergencyAccessRequest.objects.filter(id=request_id).first()
        if not emergency_request:
            return Response({"detail": "Emergency request not found"}, status=status.HTTP_404_NOT_FOUND)
        if emergency_request.status not in (
            EmergencyAccessRequest.STATUS_REQUESTED,
            EmergencyAccessRequest.STATUS_CONTEXT_VERIFIED,
        ):
            return Response({"detail": "Emergency request is no longer awaiting approval"}, status=status.HTTP_409_CONFLICT)

        approval, created = EmergencyApproval.objects.get_or_create(
            request=emergency_request,
            approver=approver,
            defaults={"decision": EmergencyApproval.DECISION_APPROVED},
        )
        if not created:
            return Response({"detail": "Approver has already decided this request"}, status=status.HTTP_409_CONFLICT)

        approved_count = EmergencyApproval.objects.filter(
            request=emergency_request,
            decision=EmergencyApproval.DECISION_APPROVED,
        ).count()
        if approved_count >= self.threshold:
            emergency_request.status = EmergencyAccessRequest.STATUS_APPROVED
            emergency_request.approved_at = timezone.now()
            emergency_request.save(update_fields=["status", "approved_at"])
        else:
            emergency_request.status = EmergencyAccessRequest.STATUS_CONTEXT_VERIFIED
            emergency_request.save(update_fields=["status"])

        return Response({
            "approval": EmergencyApprovalSerializer(approval).data,
            "approval_count": approved_count,
            "threshold": self.threshold,
            "status": emergency_request.status,
        })


class RejectEmergencyRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveEmergencyApprover]

    def post(self, request, request_id):
        approver = get_request_profile(request)
        emergency_request = EmergencyAccessRequest.objects.filter(
            id=request_id,
            status__in=[EmergencyAccessRequest.STATUS_REQUESTED, EmergencyAccessRequest.STATUS_CONTEXT_VERIFIED],
        ).first()
        if not emergency_request:
            return Response({"detail": "Emergency request not found or already decided"}, status=status.HTTP_409_CONFLICT)
        approval, created = EmergencyApproval.objects.get_or_create(
            request=emergency_request,
            approver=approver,
            defaults={"decision": EmergencyApproval.DECISION_REJECTED},
        )
        if not created:
            return Response({"detail": "Approver has already decided this request"}, status=status.HTTP_409_CONFLICT)
        emergency_request.status = EmergencyAccessRequest.STATUS_REJECTED
        emergency_request.save(update_fields=["status"])
        return Response(EmergencyApprovalSerializer(approval).data)


class PatientRecordTargetsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveDoctor]

    def get(self, request):
        patient_wallet = request.query_params.get("wallet", "").lower()
        patient = UserProfile.objects.filter(wallet=patient_wallet, role=UserProfile.ROLE_PATIENT).first()
        if not patient:
            return Response({"detail": "Patient not found"}, status=status.HTTP_404_NOT_FOUND)

        records = Record.objects.filter(patient=patient, active=True).order_by("-created_at")
        return Response(
            [
                {
                    "record_id": r.record_id,
                    "patient_wallet": patient.wallet,
                    "name": r.name,
                    "created_at": r.created_at.isoformat(),
                }
                for r in records
            ]
        )


class _PatientDecisionBaseView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActivePatient]
    target_status = None
    timestamp_field = None

    def post(self, request, request_id):
        serializer = DecisionSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        patient = get_request_profile(request)

        req = AccessRequest.objects.filter(id=request_id, patient=patient).first()
        if not req:
            return Response({"detail": "Access request not found"}, status=status.HTTP_404_NOT_FOUND)
        if req.status != AccessRequest.STATUS_PENDING and self.target_status != AccessRequest.STATUS_REVOKED:
            return Response({"detail": "Request is not pending"}, status=status.HTTP_409_CONFLICT)
        if self.target_status == AccessRequest.STATUS_REVOKED and req.status != AccessRequest.STATUS_APPROVED:
            return Response({"detail": "Only approved requests can be revoked"}, status=status.HTTP_409_CONFLICT)

        chain = ChainService()
        if not chain.assert_patient_owns_record(req.record.record_id, patient.wallet):
            return Response({"detail": "Not record owner on chain"}, status=status.HTTP_403_FORBIDDEN)

        req.status = self.target_status
        setattr(req, self.timestamp_field, timezone.now())
        req.decision_tx_hash = serializer.validated_data.get("decision_tx_hash", "")
        req.save(update_fields=["status", self.timestamp_field, "decision_tx_hash"])
        return Response(AccessRequestSerializer(req).data)


class ApproveRequestView(_PatientDecisionBaseView):
    target_status = AccessRequest.STATUS_APPROVED
    timestamp_field = "approved_at"


class RejectRequestView(_PatientDecisionBaseView):
    target_status = AccessRequest.STATUS_REJECTED
    timestamp_field = "rejected_at"


class RevokeRequestView(_PatientDecisionBaseView):
    target_status = AccessRequest.STATUS_REVOKED
    timestamp_field = "revoked_at"
