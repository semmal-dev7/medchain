from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.records.models import Record
from apps.hospitals.models import Hospital, HospitalMembership
from apps.users.models import UserProfile

from .models import AccessRequest, Appointment, EmergencyAccessGrant, EmergencyAccessRequest


class EmergencyAccessRequestTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.doctor_wallet = "0x0000000000000000000000000000000000000001"
        self.patient_wallet = "0x0000000000000000000000000000000000000002"
        self.doctor_user = User.objects.create_user(username=self.doctor_wallet)
        self.patient_user = User.objects.create_user(username=self.patient_wallet)
        self.doctor = UserProfile.objects.create(
            wallet=self.doctor_wallet,
            role=UserProfile.ROLE_DOCTOR,
        )
        self.patient = UserProfile.objects.create(
            wallet=self.patient_wallet,
            role=UserProfile.ROLE_PATIENT,
        )
        self.hospital = Hospital.objects.create(
            wallet="0x0000000000000000000000000000000000000005",
            name="Emergency Hospital",
            registered_by=self.patient,
        )
        HospitalMembership.objects.create(
            hospital=self.hospital,
            user=self.doctor,
            role=HospitalMembership.ROLE_DOCTOR,
            emergency_access=True,
        )
        self.record = Record.objects.create(
            record_id=1,
            patient=self.patient,
            ipfs_hash="ipfs://encrypted-record",
            encrypted_key_ref="kms:record-1",
            name="Emergency record",
            tx_hash="0x" + "1" * 64,
        )
        self.client.force_authenticate(user=self.doctor_user)

        self.approver_one_wallet = "0x0000000000000000000000000000000000000003"
        self.approver_two_wallet = "0x0000000000000000000000000000000000000004"
        self.approver_one_user = User.objects.create_user(username=self.approver_one_wallet)
        self.approver_two_user = User.objects.create_user(username=self.approver_two_wallet)
        UserProfile.objects.create(
            wallet=self.approver_one_wallet,
            role=UserProfile.ROLE_EMERGENCY_APPROVER,
        )
        UserProfile.objects.create(
            wallet=self.approver_two_wallet,
            role=UserProfile.ROLE_EMERGENCY_APPROVER,
        )

    def test_doctor_can_create_context_bound_emergency_request(self):
        response = self.client.post(
            "/api/v1/access/emergency/requests",
            {
                "record_id": self.record.record_id,
                "patient_wallet": self.patient_wallet,
                "context": "road_accident",
                "reason": "Patient is unconscious after a road accident.",
                "requested_resources": ["Patient", "AllergyIntolerance", "MedicationStatement"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], EmergencyAccessRequest.STATUS_REQUESTED)
        self.assertEqual(response.data["requested_resources"], [
            "Patient",
            "AllergyIntolerance",
            "MedicationStatement",
        ])

    def test_emergency_request_requires_meaningful_reason(self):
        response = self.client.post(
            "/api/v1/access/emergency/requests",
            {
                "record_id": self.record.record_id,
                "patient_wallet": self.patient_wallet,
                "context": "cardiac_event",
                "reason": "urgent",
                "requested_resources": ["Patient"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("reason", response.data)

    def test_unapproved_request_cannot_receive_temporary_grant(self):
        request_obj = EmergencyAccessRequest.objects.create(
            record=self.record,
            patient=self.patient,
            doctor=self.doctor,
            context="cardiac_event",
            reason="Patient requires urgent cardiac review.",
            requested_resources=["Patient", "Condition"],
        )

        response = self.client.post(f"/api/v1/access/emergency/requests/{request_obj.id}/grant")

        self.assertEqual(response.status_code, 409)
        self.assertFalse(EmergencyAccessGrant.objects.filter(request=request_obj).exists())

    def test_approved_request_grant_expires_and_is_rejected(self):
        request_obj = EmergencyAccessRequest.objects.create(
            record=self.record,
            patient=self.patient,
            doctor=self.doctor,
            context="road_accident",
            reason="Patient is unconscious after a road accident.",
            requested_resources=["Patient", "AllergyIntolerance"],
            status=EmergencyAccessRequest.STATUS_APPROVED,
        )

        issued = self.client.post(f"/api/v1/access/emergency/requests/{request_obj.id}/grant")

        self.assertEqual(issued.status_code, 200)
        self.assertIn("grant_token", issued.data)
        self.assertEqual(issued.data["resources"], ["Patient", "AllergyIntolerance"])
        self.assertGreaterEqual(
            timezone.datetime.fromisoformat(issued.data["expires_at"].replace("Z", "+00:00")),
            timezone.now() + timezone.timedelta(minutes=29),
        )

        grant = EmergencyAccessGrant.objects.get(request=request_obj)
        grant.expires_at = timezone.now() - timezone.timedelta(seconds=1)
        grant.save(update_fields=["expires_at"])
        expired = self.client.post(
            "/api/v1/access/emergency/grants/validate",
            {"grant_token": issued.data["grant_token"]},
            format="json",
        )

        self.assertEqual(expired.status_code, 403)
        request_obj.refresh_from_db()
        self.assertEqual(request_obj.status, EmergencyAccessRequest.STATUS_EXPIRED)

    def test_two_distinct_approvers_are_required(self):
        request_obj = EmergencyAccessRequest.objects.create(
            record=self.record,
            patient=self.patient,
            doctor=self.doctor,
            context="critical_condition",
            reason="Patient needs urgent review of critical conditions.",
            requested_resources=["Patient", "Condition"],
        )

        self.client.force_authenticate(user=self.approver_one_user)
        first = self.client.post(f"/api/v1/access/emergency/requests/{request_obj.id}/approve")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.data["approval_count"], 1)
        self.assertEqual(first.data["status"], EmergencyAccessRequest.STATUS_CONTEXT_VERIFIED)

        duplicate = self.client.post(f"/api/v1/access/emergency/requests/{request_obj.id}/approve")
        self.assertEqual(duplicate.status_code, 409)

        self.client.force_authenticate(user=self.approver_two_user)
        second = self.client.post(f"/api/v1/access/emergency/requests/{request_obj.id}/approve")
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.data["approval_count"], 2)
        self.assertEqual(second.data["status"], EmergencyAccessRequest.STATUS_APPROVED)

    def test_doctor_can_view_record_after_patient_approval(self):
        pending = self.client.get("/api/v1/access/records/1")
        self.assertEqual(pending.status_code, 403)

        AccessRequest.objects.create(
            record=self.record,
            patient=self.patient,
            doctor=self.doctor,
            status=AccessRequest.STATUS_APPROVED,
        )
        approved = self.client.get("/api/v1/access/records/1")

        self.assertEqual(approved.status_code, 200)
        self.assertEqual(approved.data["record_id"], 1)

    def test_approved_hospital_doctor_can_update_fhir_resources(self):
        AccessRequest.objects.create(
            record=self.record,
            patient=self.patient,
            doctor=self.doctor,
            status=AccessRequest.STATUS_APPROVED,
        )
        response = self.client.patch(
            "/api/v1/access/records/1/fhir",
            {"fhir_resources": [{"resourceType": "AllergyIntolerance", "code": {"text": "Penicillin"}}]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.record.refresh_from_db()
        self.assertEqual(self.record.fhir_bundle["entry"][0]["resource"]["resourceType"], "AllergyIntolerance")

    def test_patient_can_book_and_doctor_can_confirm_appointment(self):
        self.client.force_authenticate(user=self.patient_user)
        booked = self.client.post(
            "/api/v1/access/appointments/patient",
            {
                "doctor_wallet": self.doctor_wallet,
                "scheduled_for": "2026-10-01T10:30:00Z",
                "reason": "Follow-up consultation",
            },
            format="json",
        )
        self.assertEqual(booked.status_code, 201)
        self.assertEqual(booked.data["status"], Appointment.STATUS_REQUESTED)

        self.client.force_authenticate(user=self.doctor_user)
        appointment_id = booked.data["id"]
        confirmed = self.client.patch(
            f"/api/v1/access/appointments/{appointment_id}",
            {"status": Appointment.STATUS_CONFIRMED},
            format="json",
        )
        self.assertEqual(confirmed.status_code, 200)
        self.assertEqual(confirmed.data["status"], Appointment.STATUS_CONFIRMED)

    def test_temporary_grant_discloses_only_approved_resource_types(self):
        request_obj = EmergencyAccessRequest.objects.create(
            record=self.record,
            patient=self.patient,
            doctor=self.doctor,
            context="road_accident",
            reason="Patient is unconscious after a road accident.",
            requested_resources=["Patient", "AllergyIntolerance"],
            status=EmergencyAccessRequest.STATUS_APPROVED,
        )
        issued = self.client.post(f"/api/v1/access/emergency/requests/{request_obj.id}/grant")
        token = issued.data["grant_token"]

        allowed = self.client.post(
            "/api/v1/access/emergency/grants/disclose",
            {"grant_token": token, "resource_type": "AllergyIntolerance"},
            format="json",
        )
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(allowed.data["resources"][0]["resourceType"], "AllergyIntolerance")

        blocked = self.client.post(
            "/api/v1/access/emergency/grants/disclose",
            {"grant_token": token, "resource_type": "DiagnosticReport"},
            format="json",
        )
        self.assertEqual(blocked.status_code, 403)
