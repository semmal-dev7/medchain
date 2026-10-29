from datetime import timedelta

from cryptography.fernet import InvalidToken
from django.db import models, transaction
from django.http import FileResponse
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.chain.services import ChainService
from apps.records.models import Record
from apps.records.serializers import RecordSerializer
from apps.records.encryption import decrypt_file
from apps.hospitals.models import Hospital, HospitalEmergencyPolicy, HospitalMembership
from apps.hospitals.emergency_policy import (
    EMERGENCY_APPROVAL_THRESHOLD,
    EMERGENCY_REQUEST_APPROVER_COUNT,
    EMERGENCY_APPROVAL_WINDOW_MINUTES,
    emergency_committee,
)
from apps.records.clinical import build_fhir_bundle, create_clinical_commitment
from apps.users.models import UserProfile
from apps.users.permissions import IsActiveDoctor, IsActiveEmergencyApprover, IsActivePatient, get_request_profile

from .emergency import issue_temporary_grant, validate_temporary_grant
from .models import AccessRequest, Appointment, EmergencyAccessRequest, EmergencyApproval, EmergencyRequestApprover
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
            models.Q(record=record) | models.Q(patient=record.patient),
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
            models.Q(record=record) | models.Q(patient=record.patient),
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
        approved = AccessRequest.objects.filter(models.Q(record=record) | models.Q(patient=record.patient), doctor=doctor, status=AccessRequest.STATUS_APPROVED).exists() if record else False
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

    @transaction.atomic
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

        hospital = Hospital.objects.select_for_update().filter(
            id=data["hospital_id"],
            status=Hospital.STATUS_ACTIVE,
        ).first()
        if not hospital:
            return Response({"detail": "Selected hospital is not active."}, status=status.HTTP_403_FORBIDDEN)
        membership = HospitalMembership.objects.filter(
            user=doctor,
            role__in=[HospitalMembership.ROLE_DOCTOR, HospitalMembership.ROLE_EMERGENCY_DOCTOR],
            active=True,
            hospital=hospital,
        ).first()
        if not membership:
            return Response(
                {"detail": "Select a hospital where you have an active doctor membership."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not membership.emergency_access:
            return Response(
                {"detail": "The hospital administrator must enable emergency access for this doctor."},
                status=status.HTTP_403_FORBIDDEN,
            )
        selected_wallets = data["approver_wallets"]
        eligible_wallets = set(
            emergency_committee(membership.hospital)
            .exclude(user=doctor)
            .values_list("user_id", flat=True)
        )
        if not set(selected_wallets).issubset(eligible_wallets):
            return Response(
                {"detail": "All selected approvers must be active emergency doctors from the selected hospital."},
                status=status.HTTP_400_BAD_REQUEST,
            )
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
        EmergencyRequestApprover.objects.bulk_create([
            EmergencyRequestApprover(request=request_obj, approver_id=wallet)
            for wallet in selected_wallets
        ])
        return Response(EmergencyAccessRequestSerializer(request_obj).data, status=status.HTTP_201_CREATED)


class EmergencyEligibleApproversView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveDoctor]

    def get(self, request):
        doctor = get_request_profile(request)
        authorized_hospital_ids = HospitalMembership.objects.filter(
            user=doctor,
            role__in=[HospitalMembership.ROLE_DOCTOR, HospitalMembership.ROLE_EMERGENCY_DOCTOR],
            active=True,
            emergency_access=True,
            hospital__status="active",
        ).values_list("hospital_id", flat=True)
        memberships = emergency_committee().filter(
            hospital_id__in=authorized_hospital_ids,
        ).exclude(user=doctor).select_related("hospital", "user").order_by(
            "hospital__name",
            "user__full_name",
            "user__wallet",
        )
        hospitals = {}
        for membership in memberships:
            hospital = hospitals.setdefault(
                str(membership.hospital_id),
                {
                    "id": str(membership.hospital_id),
                    "name": membership.hospital.name,
                    "wallet": membership.hospital.wallet,
                    "doctors": [],
                },
            )
            hospital["doctors"].append({
                "wallet": membership.user.wallet,
                "full_name": membership.user.full_name,
            })
        return Response([
            hospital for hospital in hospitals.values()
            if len(hospital["doctors"]) >= EMERGENCY_REQUEST_APPROVER_COUNT
        ])


class OutgoingEmergencyRequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveDoctor]

    def get(self, request):
        doctor = get_request_profile(request)
        requests_qs = EmergencyAccessRequest.objects.filter(doctor=doctor).order_by("-requested_at")
        return Response(EmergencyAccessRequestSerializer(requests_qs, many=True).data)


class IssueEmergencyGrantView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveDoctor]

    @transaction.atomic
    def post(self, request, request_id):
        doctor = get_request_profile(request)
        emergency_request = EmergencyAccessRequest.objects.select_for_update().filter(id=request_id, doctor=doctor).first()
        if not emergency_request:
            return Response({"detail": "Emergency request not found"}, status=status.HTTP_404_NOT_FOUND)
        if emergency_request.status != EmergencyAccessRequest.STATUS_APPROVED:
            return Response({"detail": "Emergency request is not approved"}, status=status.HTTP_409_CONFLICT)
        hospital = Hospital.objects.select_for_update().filter(
            id=emergency_request.hospital_id,
            status=Hospital.STATUS_ACTIVE,
        ).first()
        if not hospital:
            return Response({"detail": "The hospital is no longer active."}, status=status.HTTP_409_CONFLICT)
        if not HospitalMembership.objects.filter(
            hospital=hospital,
            user=doctor,
            active=True,
            emergency_access=True,
            hospital__status="active",
        ).exists():
            return Response({"detail": "Doctor's emergency hospital authorization is no longer active."}, status=status.HTTP_403_FORBIDDEN)
        selected_wallets = list(emergency_request.selected_approvers.values_list("wallet", flat=True))
        if len(selected_wallets) != EMERGENCY_REQUEST_APPROVER_COUNT:
            return Response({"detail": "Emergency request does not have three assigned approvers."}, status=status.HTTP_409_CONFLICT)
        eligible_selected_wallets = list(
            emergency_committee(hospital)
            .filter(user_id__in=selected_wallets)
            .values_list("user_id", flat=True)
        )
        approved_count = EmergencyApproval.objects.filter(
            request=emergency_request,
            approver_id__in=eligible_selected_wallets,
            approver__status=UserProfile.STATUS_ACTIVE,
            decision=EmergencyApproval.DECISION_APPROVED,
        ).count()
        if approved_count < EMERGENCY_APPROVAL_THRESHOLD:
            return Response({"detail": "Two current selected-approver approvals are required to issue access."}, status=status.HTTP_409_CONFLICT)

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


class EmergencyRecordView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveDoctor]

    def post(self, request):
        grant = validate_temporary_grant(request.data.get("grant_token", ""))
        doctor = get_request_profile(request)
        if not grant or grant.request.doctor_id != doctor.wallet:
            return Response({"detail": "Temporary emergency access expired or invalid"}, status=status.HTTP_403_FORBIDDEN)

        requested_record_id = request.data.get("record_id")
        if requested_record_id is not None:
            record = Record.objects.filter(
                record_id=requested_record_id,
                patient=grant.request.patient,
                active=True,
            ).first()
            if not record:
                return Response({"detail": "The emergency medical record is no longer active"}, status=status.HTTP_404_NOT_FOUND)
        else:
            record = grant.request.record
        if not record.active:
            return Response({"detail": "The emergency medical record is no longer active"}, status=status.HTTP_404_NOT_FOUND)
        if record.encrypted_file:
            try:
                with record.encrypted_file.open("rb") as encrypted_file:
                    contents = decrypt_file(encrypted_file.read())
            except (InvalidToken, OSError):
                return Response({"detail": "Stored emergency medical file could not be decrypted"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            response = FileResponse(
                iter([contents]),
                content_type="application/pdf",
                as_attachment=False,
                filename=record.original_file_name or f"emergency-medical-record-{record.record_id}.pdf",
            )
        elif record.uploaded_file:
            response = FileResponse(
                record.uploaded_file.open("rb"),
                content_type="application/pdf",
                as_attachment=False,
                filename=record.uploaded_file.name.rsplit("/", 1)[-1],
            )
        else:
            return Response({"detail": "The emergency medical file is not available for viewing"}, status=status.HTTP_404_NOT_FOUND)

        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response


class PendingEmergencyRequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveEmergencyApprover]

    def get(self, request):
        now = timezone.now()
        EmergencyAccessRequest.objects.filter(
            status__in=[
                EmergencyAccessRequest.STATUS_REQUESTED,
                EmergencyAccessRequest.STATUS_CONTEXT_VERIFIED,
            ],
            requested_at__lte=now - timedelta(minutes=EMERGENCY_APPROVAL_WINDOW_MINUTES),
        ).update(status=EmergencyAccessRequest.STATUS_EXPIRED)

        approver = get_request_profile(request)
        approver_hospitals = emergency_committee().filter(
            user=approver,
        ).values_list("hospital_id", flat=True)
        requests_qs = EmergencyAccessRequest.objects.filter(
            hospital_id__in=approver_hospitals,
            selected_approvers=approver,
            status__in=[EmergencyAccessRequest.STATUS_REQUESTED, EmergencyAccessRequest.STATUS_CONTEXT_VERIFIED]
        ).distinct().order_by("requested_at")
        return Response(EmergencyAccessRequestSerializer(requests_qs, many=True).data)


class ApproveEmergencyRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveEmergencyApprover]

    def post(self, request, request_id):
        approver = get_request_profile(request)
        with transaction.atomic():
            emergency_request = EmergencyAccessRequest.objects.select_for_update().filter(id=request_id).first()
            if not emergency_request:
                return Response({"detail": "Emergency request not found"}, status=status.HTTP_404_NOT_FOUND)
            if emergency_request.status not in (
                EmergencyAccessRequest.STATUS_REQUESTED,
                EmergencyAccessRequest.STATUS_CONTEXT_VERIFIED,
            ):
                return Response({"detail": "Emergency request is no longer awaiting approval"}, status=status.HTTP_409_CONFLICT)
            if timezone.now() >= emergency_request.requested_at + timedelta(minutes=EMERGENCY_APPROVAL_WINDOW_MINUTES):
                emergency_request.status = EmergencyAccessRequest.STATUS_EXPIRED
                emergency_request.save(update_fields=["status"])
                return Response(
                    {"detail": f"The {EMERGENCY_APPROVAL_WINDOW_MINUTES}-minute emergency approval window has expired."},
                    status=status.HTTP_409_CONFLICT,
                )
            hospital = Hospital.objects.select_for_update().filter(
                id=emergency_request.hospital_id,
                status=Hospital.STATUS_ACTIVE,
            ).first()
            if not hospital:
                return Response({"detail": "The request's hospital is no longer active."}, status=status.HTTP_409_CONFLICT)
            if approver.wallet == emergency_request.doctor_id:
                return Response({"detail": "The requesting doctor cannot approve their own emergency request."}, status=status.HTTP_403_FORBIDDEN)
            if (
                not emergency_request.selected_approvers.filter(pk=approver.pk).exists()
                or not emergency_committee(hospital).filter(user=approver).exists()
            ):
                return Response({"detail": "Only a selected active emergency doctor from this hospital can approve."}, status=status.HTTP_403_FORBIDDEN)
            selected_wallets = list(emergency_request.selected_approvers.values_list("wallet", flat=True))
            eligible_selected_wallets = list(
                emergency_committee(hospital)
                .filter(user_id__in=selected_wallets)
                .values_list("user_id", flat=True)
            )

            approval, created = EmergencyApproval.objects.get_or_create(
                request=emergency_request,
                approver=approver,
                defaults={"decision": EmergencyApproval.DECISION_APPROVED},
            )
            if not created:
                return Response({"detail": "Approver has already decided this request"}, status=status.HTTP_409_CONFLICT)

            approved_count = EmergencyApproval.objects.filter(
                request=emergency_request,
                approver_id__in=eligible_selected_wallets,
                approver__status=UserProfile.STATUS_ACTIVE,
                decision=EmergencyApproval.DECISION_APPROVED,
            ).count()
            if approved_count >= EMERGENCY_APPROVAL_THRESHOLD:
                emergency_request.status = EmergencyAccessRequest.STATUS_APPROVED
                emergency_request.approved_at = timezone.now()
                emergency_request.save(update_fields=["status", "approved_at"])
            else:
                emergency_request.status = EmergencyAccessRequest.STATUS_CONTEXT_VERIFIED
                emergency_request.save(update_fields=["status"])

        return Response({
            "approval": EmergencyApprovalSerializer(approval).data,
            "approval_count": approved_count,
            "threshold": EMERGENCY_APPROVAL_THRESHOLD,
            "committee_size": EMERGENCY_REQUEST_APPROVER_COUNT,
            "status": emergency_request.status,
        })


class RejectEmergencyRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveEmergencyApprover]

    def post(self, request, request_id):
        approver = get_request_profile(request)
        with transaction.atomic():
            emergency_request = EmergencyAccessRequest.objects.select_for_update().filter(
                id=request_id,
                status__in=[EmergencyAccessRequest.STATUS_REQUESTED, EmergencyAccessRequest.STATUS_CONTEXT_VERIFIED],
            ).first()
            if not emergency_request:
                return Response({"detail": "Emergency request not found or already decided"}, status=status.HTTP_409_CONFLICT)
            if timezone.now() >= emergency_request.requested_at + timedelta(minutes=EMERGENCY_APPROVAL_WINDOW_MINUTES):
                emergency_request.status = EmergencyAccessRequest.STATUS_EXPIRED
                emergency_request.save(update_fields=["status"])
                return Response(
                    {"detail": f"The {EMERGENCY_APPROVAL_WINDOW_MINUTES}-minute emergency approval window has expired."},
                    status=status.HTTP_409_CONFLICT,
                )
            hospital = Hospital.objects.select_for_update().filter(
                id=emergency_request.hospital_id,
                status=Hospital.STATUS_ACTIVE,
            ).first()
            if not hospital:
                return Response({"detail": "The request's hospital is no longer active."}, status=status.HTTP_409_CONFLICT)
            if approver.wallet == emergency_request.doctor_id:
                return Response({"detail": "The requesting doctor cannot reject their own emergency request."}, status=status.HTTP_403_FORBIDDEN)
            if (
                not emergency_request.selected_approvers.filter(pk=approver.pk).exists()
                or not emergency_committee(hospital).filter(user=approver).exists()
            ):
                return Response({"detail": "Only a selected active emergency doctor from this hospital can decide this request."}, status=status.HTTP_403_FORBIDDEN)
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
            if req.status == self.target_status:
                return Response(AccessRequestSerializer(req).data)
            if self.target_status == AccessRequest.STATUS_REJECTED and req.status == AccessRequest.STATUS_APPROVED:
                pass
            else:
                return Response({"detail": "Request is not pending"}, status=status.HTTP_409_CONFLICT)
        if self.target_status == AccessRequest.STATUS_REVOKED and req.status not in (AccessRequest.STATUS_APPROVED, AccessRequest.STATUS_PENDING):
            return Response({"detail": "Only approved or pending requests can be revoked"}, status=status.HTTP_409_CONFLICT)

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
