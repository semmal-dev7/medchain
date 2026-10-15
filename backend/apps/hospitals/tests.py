from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import UserProfile

from .models import Hospital, HospitalDoctorRequest, HospitalMembership


class HospitalOnboardingTests(TestCase):
    def setUp(self):
        self.admin_wallet = "0x0000000000000000000000000000000000000101"
        self.doctor_wallet = "0x0000000000000000000000000000000000000102"
        self.admin_user = User.objects.create_user(username=self.admin_wallet)
        self.doctor_user = User.objects.create_user(username=self.doctor_wallet)
        self.admin = UserProfile.objects.create(wallet=self.admin_wallet, role=UserProfile.ROLE_ADMIN)
        self.doctor = UserProfile.objects.create(wallet=self.doctor_wallet, role=UserProfile.ROLE_DOCTOR)
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin_user)

    def test_admin_can_register_hospital_and_affiliate_doctor(self):
        created = self.client.post(
            "/api/v1/hospitals/",
            {"name": "Hospital B", "wallet": "0x0000000000000000000000000000000000000103"},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        hospital_id = created.data["id"]

        affiliated = self.client.post(
            f"/api/v1/hospitals/{hospital_id}/doctors",
            {"doctor_wallet": self.doctor_wallet},
            format="json",
        )
        self.assertEqual(affiliated.status_code, 201)
        membership = HospitalMembership.objects.get(user_id=self.doctor_wallet)
        self.assertEqual(str(membership.hospital_id), hospital_id)
        self.assertEqual(membership.role, HospitalMembership.ROLE_DOCTOR)

    def test_hospital_admin_can_list_and_enable_emergency_access_for_doctor(self):
        hospital = Hospital.objects.create(
            wallet="0x0000000000000000000000000000000000000110",
            name="Emergency Access Hospital",
            registered_by=self.admin,
        )
        HospitalMembership.objects.create(hospital=hospital, user=self.admin, role=HospitalMembership.ROLE_ADMIN)
        membership = HospitalMembership.objects.create(
            hospital=hospital,
            user=self.doctor,
            role=HospitalMembership.ROLE_DOCTOR,
        )

        listed = self.client.get(f"/api/v1/hospitals/{hospital.id}/doctors")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data[0]["wallet"], self.doctor_wallet)
        self.assertFalse(listed.data[0]["emergency_access"])

        updated = self.client.patch(
            f"/api/v1/hospitals/{hospital.id}/doctors/{self.doctor_wallet}",
            {"emergency_access": True},
            format="json",
        )

        self.assertEqual(updated.status_code, 200)
        membership.refresh_from_db()
        self.assertTrue(membership.emergency_access)

    def test_hospital_admin_can_enable_doctor_as_emergency_approver(self):
        hospital = Hospital.objects.create(
            wallet="0x0000000000000000000000000000000000000111",
            name="Emergency Approver Setup Hospital",
            registered_by=self.admin,
        )
        HospitalMembership.objects.create(hospital=hospital, user=self.admin, role=HospitalMembership.ROLE_ADMIN)
        membership = HospitalMembership.objects.create(
            hospital=hospital,
            user=self.doctor,
            role=HospitalMembership.ROLE_DOCTOR,
        )

        response = self.client.patch(
            f"/api/v1/hospitals/{hospital.id}/doctors/{self.doctor_wallet}",
            {"role": HospitalMembership.ROLE_EMERGENCY_DOCTOR, "emergency_access": True},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        membership.refresh_from_db()
        self.assertEqual(membership.role, HospitalMembership.ROLE_EMERGENCY_DOCTOR)
        self.assertTrue(membership.emergency_access)

    def test_doctor_cannot_register_hospital(self):
        self.client.force_authenticate(user=self.doctor_user)
        response = self.client.post("/api/v1/hospitals/", {"name": "Unauthorized Hospital"}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_doctor_can_be_affiliated_with_multiple_hospitals(self):
        first = Hospital.objects.create(wallet=self.admin_wallet, name="Hospital A", registered_by=self.admin)
        HospitalMembership.objects.create(hospital=first, user_id=self.doctor_wallet, role=HospitalMembership.ROLE_DOCTOR)
        second = Hospital.objects.create(wallet="0x0000000000000000000000000000000000000103", name="Hospital C", registered_by=self.admin)
        HospitalMembership.objects.create(hospital=second, user=self.admin, role=HospitalMembership.ROLE_ADMIN)

        response = self.client.post(
            f"/api/v1/hospitals/{second.id}/doctors",
            {"doctor_wallet": self.doctor_wallet},
            format="json",
        )
        self.assertEqual(response.status_code, 201)

    def test_admin_can_register_multiple_hospitals(self):
        first = self.client.post(
            "/api/v1/hospitals/",
            {"name": "Hospital A", "wallet": "0x0000000000000000000000000000000000000104"},
            format="json",
        )
        second = self.client.post(
            "/api/v1/hospitals/",
            {"name": "Hospital C", "wallet": "0x0000000000000000000000000000000000000105"},
            format="json",
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(Hospital.objects.filter(registered_by=self.admin).count(), 2)

    def test_doctor_requests_hospital_and_admin_approves(self):
        hospital = Hospital.objects.create(
            wallet="0x0000000000000000000000000000000000000106",
            name="Hospital D",
            registered_by=self.admin,
        )
        HospitalMembership.objects.create(hospital=hospital, user=self.admin, role=HospitalMembership.ROLE_ADMIN)
        self.doctor.status = UserProfile.STATUS_PENDING
        self.doctor.save(update_fields=["status"])

        self.client.force_authenticate(user=self.doctor_user)
        requested = self.client.post(
            "/api/v1/hospitals/doctor-requests",
            {"hospital_wallet": hospital.wallet, "requested_role": "emergency_doctor", "reason": "Emergency department affiliation"},
            format="json",
        )
        self.assertEqual(requested.status_code, 201)
        request_id = requested.data["id"]

        self.client.force_authenticate(user=self.admin_user)
        pending = self.client.get(f"/api/v1/hospitals/{hospital.id}/doctor-requests")
        self.assertEqual(pending.status_code, 200)
        approved = self.client.post(f"/api/v1/hospitals/{hospital.id}/doctor-requests/{request_id}/approve")
        self.assertEqual(approved.status_code, 200)
        membership = HospitalMembership.objects.get(hospital=hospital, user_id=self.doctor_wallet)
        self.assertEqual(membership.role, HospitalMembership.ROLE_EMERGENCY_DOCTOR)
        self.assertTrue(membership.emergency_access)
        self.doctor.refresh_from_db()
        self.assertEqual(self.doctor.status, UserProfile.STATUS_ACTIVE)

    def test_admin_dashboard_lists_only_hospitals_it_administers(self):
        managed = Hospital.objects.create(
            wallet="0x0000000000000000000000000000000000000107",
            name="Managed Hospital",
            registered_by=self.admin,
        )
        HospitalMembership.objects.create(hospital=managed, user=self.admin, role=HospitalMembership.ROLE_ADMIN)
        Hospital.objects.create(
            wallet="0x0000000000000000000000000000000000000108",
            name="Other Hospital",
            registered_by=self.admin,
        )

        response = self.client.get("/api/v1/hospitals/mine")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["name"] for row in response.data], ["Managed Hospital"])

    def test_hospital_can_approve_more_than_three_emergency_approvers(self):
        hospital = Hospital.objects.create(
            wallet="0x0000000000000000000000000000000000000109",
            name="Emergency Committee Hospital",
            registered_by=self.admin,
        )
        HospitalMembership.objects.create(hospital=hospital, user=self.admin, role=HospitalMembership.ROLE_ADMIN)
        for index in range(3):
            wallet = f"0x{index + 200:040x}"
            profile = UserProfile.objects.create(wallet=wallet, role=UserProfile.ROLE_DOCTOR)
            HospitalMembership.objects.create(
                hospital=hospital,
                user=profile,
                role=HospitalMembership.ROLE_EMERGENCY_DOCTOR,
                active=True,
                emergency_access=True,
            )
        fourth_wallet = "0x0000000000000000000000000000000000000203"
        fourth = UserProfile.objects.create(
            wallet=fourth_wallet,
            role=UserProfile.ROLE_DOCTOR,
            status=UserProfile.STATUS_PENDING,
        )
        request_obj = HospitalDoctorRequest.objects.create(
            hospital=hospital,
            doctor=fourth,
            requested_role=HospitalMembership.ROLE_EMERGENCY_DOCTOR,
        )

        response = self.client.post(
            f"/api/v1/hospitals/{hospital.id}/doctor-requests/{request_obj.id}/approve"
        )

        self.assertEqual(response.status_code, 200)
        request_obj.refresh_from_db()
        self.assertEqual(request_obj.status, HospitalDoctorRequest.STATUS_APPROVED)
        self.assertTrue(HospitalMembership.objects.filter(
            hospital=hospital,
            user=fourth,
            role=HospitalMembership.ROLE_EMERGENCY_DOCTOR,
            emergency_access=True,
        ).exists())