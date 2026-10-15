from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.records.models import Record
from apps.hospitals.models import Hospital, HospitalMembership
from apps.users.models import UserProfile

from .models import AccessRequest, Appointment, EmergencyAccessGrant, EmergencyAccessRequest, EmergencyApproval


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
        self.approver_three_wallet = "0x0000000000000000000000000000000000000006"
        self.approver_four_wallet = "0x0000000000000000000000000000000000000009"
        self.approver_one_user = User.objects.create_user(username=self.approver_one_wallet)
        self.approver_two_user = User.objects.create_user(username=self.approver_two_wallet)
        self.approver_three_user = User.objects.create_user(username=self.approver_three_wallet)
        self.approver_four_user = User.objects.create_user(username=self.approver_four_wallet)
        self.approver_one = UserProfile.objects.create(wallet=self.approver_one_wallet, role=UserProfile.ROLE_DOCTOR)
        self.approver_two = UserProfile.objects.create(wallet=self.approver_two_wallet, role=UserProfile.ROLE_DOCTOR)
        self.approver_three = UserProfile.objects.create(wallet=self.approver_three_wallet, role=UserProfile.ROLE_DOCTOR)
        self.approver_four = UserProfile.objects.create(wallet=self.approver_four_wallet, role=UserProfile.ROLE_DOCTOR)
        for approver in (self.approver_one, self.approver_two, self.approver_three, self.approver_four):
            HospitalMembership.objects.create(
                hospital=self.hospital,
                user=approver,
                role=HospitalMembership.ROLE_DOCTOR,
                active=True,
                emergency_access=True,
            )

    def _create_emergency_request(self, selected_approvers=None, **overrides):
        values = {
            "record": self.record,
            "patient": self.patient,
            "doctor": self.doctor,
            "hospital": self.hospital,
            "context": "road_accident",
            "reason": "Patient is unconscious after a road accident.",
            "requested_resources": ["Patient", "AllergyIntolerance"],
        }
        values.update(overrides)
        request_obj = EmergencyAccessRequest._default_manager.create(**values)
        request_obj.selected_approvers.add(*(
            selected_approvers or (self.approver_one, self.approver_two, self.approver_three)
        ))
        return request_obj

    def _approved_request(self, **overrides):
        values = {
            "record": self.record,
            "patient": self.patient,
            "doctor": self.doctor,
            "hospital": self.hospital,
            "context": "road_accident",
            "reason": "Patient is unconscious after a road accident.",
            "requested_resources": ["Patient", "AllergyIntolerance"],
            "status": EmergencyAccessRequest.STATUS_APPROVED,
        }
        values.update(overrides)
        request_obj = self._create_emergency_request(**values)
        for approver in (self.approver_one, self.approver_two):
            EmergencyApproval.objects.create(
                request=request_obj,
                approver=approver,
                decision=EmergencyApproval.DECISION_APPROVED,
            )
        return request_obj

    def test_doctor_can_create_context_bound_emergency_request(self):
        response = self.client.post(
            "/api/v1/access/emergency/requests",
            {
                "record_id": self.record.record_id,
                "patient_wallet": self.patient_wallet,
                "hospital_id": str(self.hospital.id),
                "approver_wallets": [
                    self.approver_one_wallet,
                    self.approver_two_wallet,
                    self.approver_three_wallet,
                ],
                "context": "road_accident",
                "reason": "Patient is unconscious after a road accident.",
                "requested_resources": ["Patient", "AllergyIntolerance", "MedicationStatement"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], EmergencyAccessRequest.STATUS_REQUESTED)
        self.assertCountEqual(response.data["selected_approvers"], [
            self.approver_one_wallet,
            self.approver_two_wallet,
            self.approver_three_wallet,
        ])
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
                "hospital_id": str(self.hospital.id),
                "approver_wallets": [
                    self.approver_one_wallet,
                    self.approver_two_wallet,
                    self.approver_three_wallet,
                ],
                "context": "cardiac_event",
                "reason": "Emergency",
                "requested_resources": ["Patient"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("reason", response.data)

    def test_hospital_affiliation_without_emergency_permission_gets_clear_error(self):
        membership = HospitalMembership.objects.get(hospital=self.hospital, user=self.doctor)
        membership.emergency_access = False
        membership.save(update_fields=["emergency_access"])

        response = self.client.post(
            "/api/v1/access/emergency/requests",
            {
                "record_id": self.record.record_id,
                "patient_wallet": self.patient_wallet,
                "hospital_id": str(self.hospital.id),
                "approver_wallets": [
                    self.approver_one_wallet,
                    self.approver_two_wallet,
                    self.approver_three_wallet,
                ],
                "context": "road_accident",
                "reason": "Urgent care is required.",
                "requested_resources": ["Patient"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertIn("hospital administrator must enable emergency access", response.data["detail"])

    def test_emergency_authorized_doctors_are_eligible_without_separate_approver_role(self):
        response = self.client.get("/api/v1/access/emergency/eligible-approvers")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], str(self.hospital.id))
        self.assertCountEqual(
            [doctor["wallet"] for doctor in response.data[0]["doctors"]],
            [
                self.approver_one_wallet,
                self.approver_two_wallet,
                self.approver_three_wallet,
                self.approver_four_wallet,
            ],
        )

    def test_pending_requests_only_reach_selected_approvers(self):
        request_obj = self._create_emergency_request()

        self.client.force_authenticate(user=self.approver_one_user)
        selected = self.client.get("/api/v1/access/emergency/requests/pending")
        self.assertEqual(selected.status_code, 200)
        self.assertIn(str(request_obj.id), [row["id"] for row in selected.data])

        self.client.force_authenticate(user=self.approver_four_user)
        not_selected = self.client.get("/api/v1/access/emergency/requests/pending")
        self.assertEqual(not_selected.status_code, 200)
        self.assertNotIn(str(request_obj.id), [row["id"] for row in not_selected.data])
        decision = self.client.post(f"/api/v1/access/emergency/requests/{request_obj.id}/approve")
        self.assertEqual(decision.status_code, 403)

    def test_emergency_request_rejects_approver_from_another_hospital(self):
        other_hospital = Hospital.objects.create(
            wallet="0x0000000000000000000000000000000000000007",
            name="Other Emergency Hospital",
            registered_by=self.patient,
        )
        other_wallet = "0x0000000000000000000000000000000000000008"
        other_doctor = UserProfile.objects.create(wallet=other_wallet, role=UserProfile.ROLE_DOCTOR)
        HospitalMembership.objects.create(
            hospital=other_hospital,
            user=other_doctor,
            role=HospitalMembership.ROLE_EMERGENCY_DOCTOR,
            active=True,
            emergency_access=True,
        )

        response = self.client.post(
            "/api/v1/access/emergency/requests",
            {
                "record_id": self.record.record_id,
                "patient_wallet": self.patient_wallet,
                "hospital_id": str(self.hospital.id),
                "approver_wallets": [
                    self.approver_one_wallet,
                    self.approver_two_wallet,
                    other_wallet,
                ],
                "context": "road_accident",
                "reason": "Urgent medical intervention is required.",
                "requested_resources": ["Patient"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("selected hospital", response.data["detail"])
        self.assertFalse(EmergencyAccessRequest.objects.exists())

    def test_unapproved_request_cannot_receive_temporary_grant(self):
        request_obj = self._create_emergency_request(
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
        request_obj = self._approved_request()

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

    def test_emergency_grant_allows_requesting_doctor_to_view_record_only(self):
        request_obj = self._approved_request()
        request_obj.record.uploaded_file = SimpleUploadedFile(
            "emergency-record.pdf",
            b"%PDF-1.4 emergency patient data",
            content_type="application/pdf",
        )
        request_obj.record.save(update_fields=["uploaded_file"])
        issued = self.client.post(f"/api/v1/access/emergency/requests/{request_obj.id}/grant")
        self.assertEqual(issued.status_code, 200)

        viewed = self.client.post(
            "/api/v1/access/emergency/grants/record",
            {"grant_token": issued.data["grant_token"]},
            format="json",
        )

        self.assertEqual(viewed.status_code, 200)
        self.assertEqual(b"".join(viewed.streaming_content), b"%PDF-1.4 emergency patient data")
        self.assertEqual(viewed["Cache-Control"], "private, no-store")

        other_wallet = "0x0000000000000000000000000000000000000010"
        other_user = User.objects.create_user(username=other_wallet)
        UserProfile.objects.create(wallet=other_wallet, role=UserProfile.ROLE_DOCTOR)
        self.client.force_authenticate(user=other_user)
        denied = self.client.post(
            "/api/v1/access/emergency/grants/record",
            {"grant_token": issued.data["grant_token"]},
            format="json",
        )
        self.assertEqual(denied.status_code, 403)

    def test_emergency_record_view_rejects_expired_grant(self):
        request_obj = self._approved_request()
        request_obj.record.uploaded_file = SimpleUploadedFile(
            "emergency-record.pdf",
            b"%PDF-1.4 emergency patient data",
            content_type="application/pdf",
        )
        request_obj.record.save(update_fields=["uploaded_file"])
        issued = self.client.post(f"/api/v1/access/emergency/requests/{request_obj.id}/grant")
        grant = EmergencyAccessGrant.objects.get(request=request_obj)
        grant.expires_at = timezone.now() - timezone.timedelta(seconds=1)
        grant.save(update_fields=["expires_at"])

        response = self.client.post(
            "/api/v1/access/emergency/grants/record",
            {"grant_token": issued.data["grant_token"]},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_hospital_revocation_invalidates_temporary_grant(self):
        request_obj = self._approved_request()
        issued = self.client.post(f"/api/v1/access/emergency/requests/{request_obj.id}/grant")
        self.assertEqual(issued.status_code, 200)

        membership = HospitalMembership.objects.get(hospital=self.hospital, user=self.doctor)
        membership.emergency_access = False
        membership.save(update_fields=["emergency_access"])
        validated = self.client.post(
            "/api/v1/access/emergency/grants/validate",
            {"grant_token": issued.data["grant_token"]},
            format="json",
        )

        self.assertEqual(validated.status_code, 403)

    def test_two_distinct_approvers_are_required(self):
        request_obj = self._create_emergency_request(
            record=self.record,
            patient=self.patient,
            doctor=self.doctor,
            hospital=self.hospital,
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
        self.assertEqual(second.data["committee_size"], 3)
        self.assertEqual(second.data["status"], EmergencyAccessRequest.STATUS_APPROVED)

    def test_non_committee_doctor_cannot_approve(self):
        request_obj = self._create_emergency_request(
            record=self.record,
            patient=self.patient,
            doctor=self.doctor,
            hospital=self.hospital,
            context="critical_condition",
            reason="Patient needs urgent review of critical conditions.",
            requested_resources=["Patient", "Condition"],
        )

        self.client.force_authenticate(user=self.approver_four_user)
        response = self.client.post(f"/api/v1/access/emergency/requests/{request_obj.id}/approve")

        self.assertEqual(response.status_code, 403)
        self.assertFalse(EmergencyApproval.objects.filter(request=request_obj).exists())

    def test_requesting_doctor_cannot_approve_own_emergency_request(self):
        HospitalMembership.objects.filter(hospital=self.hospital, user=self.approver_three).delete()
        doctor_membership = HospitalMembership.objects.get(hospital=self.hospital, user=self.doctor)
        doctor_membership.role = HospitalMembership.ROLE_EMERGENCY_DOCTOR
        doctor_membership.save(update_fields=["role"])
        request_obj = self._create_emergency_request(
            selected_approvers=(self.doctor, self.approver_one, self.approver_two),
            record=self.record,
            patient=self.patient,
            doctor=self.doctor,
            hospital=self.hospital,
            context="critical_condition",
            reason="Patient needs urgent review of critical conditions.",
            requested_resources=["Patient", "Condition"],
        )

        response = self.client.post(f"/api/v1/access/emergency/requests/{request_obj.id}/approve")

        self.assertEqual(response.status_code, 403)
        self.assertFalse(EmergencyApproval.objects.filter(request=request_obj).exists())

    def test_expired_approval_window_closes_request(self):
        request_obj = self._create_emergency_request(
            record=self.record,
            patient=self.patient,
            doctor=self.doctor,
            hospital=self.hospital,
            context="critical_condition",
            reason="Patient needs urgent review of critical conditions.",
            requested_resources=["Patient", "Condition"],
        )
        request_obj.requested_at = timezone.now() - timezone.timedelta(minutes=31)
        request_obj.save(update_fields=["requested_at"])
        self.client.force_authenticate(user=self.approver_one_user)

        response = self.client.post(f"/api/v1/access/emergency/requests/{request_obj.id}/approve")

        self.assertEqual(response.status_code, 409)
        request_obj.refresh_from_db()
        self.assertEqual(request_obj.status, EmergencyAccessRequest.STATUS_EXPIRED)
        self.assertFalse(EmergencyApproval.objects.filter(request=request_obj).exists())

    def test_rejected_request_cannot_be_approved(self):
        request_obj = self._create_emergency_request(
            record=self.record,
            patient=self.patient,
            doctor=self.doctor,
            hospital=self.hospital,
            context="critical_condition",
            reason="Patient needs urgent review of critical conditions.",
            requested_resources=["Patient", "Condition"],
            status=EmergencyAccessRequest.STATUS_REJECTED,
        )
        self.client.force_authenticate(user=self.approver_one_user)

        response = self.client.post(f"/api/v1/access/emergency/requests/{request_obj.id}/approve")

        self.assertEqual(response.status_code, 409)
        self.assertFalse(EmergencyApproval.objects.filter(request=request_obj).exists())

    def test_committee_rejection_closes_request(self):
        request_obj = self._create_emergency_request(
            record=self.record,
            patient=self.patient,
            doctor=self.doctor,
            hospital=self.hospital,
            context="critical_condition",
            reason="Patient needs urgent review of critical conditions.",
            requested_resources=["Patient", "Condition"],
        )
        self.client.force_authenticate(user=self.approver_one_user)
        rejected = self.client.post(f"/api/v1/access/emergency/requests/{request_obj.id}/reject")
        self.assertEqual(rejected.status_code, 200)
        self.assertEqual(rejected.data["decision"], EmergencyApproval.DECISION_REJECTED)

        self.client.force_authenticate(user=self.approver_two_user)
        approved = self.client.post(f"/api/v1/access/emergency/requests/{request_obj.id}/approve")

        self.assertEqual(approved.status_code, 409)
        request_obj.refresh_from_db()
        self.assertEqual(request_obj.status, EmergencyAccessRequest.STATUS_REJECTED)

    def test_inactive_committee_member_cannot_decide(self):
        membership = HospitalMembership.objects.get(hospital=self.hospital, user=self.approver_one)
        membership.active = False
        membership.save(update_fields=["active"])
        request_obj = self._create_emergency_request(
            record=self.record,
            patient=self.patient,
            doctor=self.doctor,
            hospital=self.hospital,
            context="critical_condition",
            reason="Patient needs urgent review of critical conditions.",
            requested_resources=["Patient", "Condition"],
        )
        self.client.force_authenticate(user=self.approver_one_user)

        response = self.client.post(f"/api/v1/access/emergency/requests/{request_obj.id}/approve")

        self.assertEqual(response.status_code, 403)
        self.assertFalse(EmergencyApproval.objects.filter(request=request_obj).exists())

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
        request_obj = self._approved_request()
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
