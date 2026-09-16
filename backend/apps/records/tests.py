from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import UserProfile

from .models import Record


class RecordApiTests(TestCase):
    def setUp(self):
        self.wallet = "0x0000000000000000000000000000000000000011"
        self.user = User.objects.create_user(username=self.wallet)
        UserProfile.objects.create(wallet=self.wallet, role=UserProfile.ROLE_PATIENT)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_patient_can_create_record(self):
        response = self.client.post(
            "/api/v1/records/",
            {
                "record_id": 1700000000000001,
                "ipfs_hash": "ipfs://record-1",
                "encrypted_key_ref": "kms:record-1",
                "name": "Blood test",
                "description": "Emergency blood test result",
                "tx_hash": "pending-1700000000000",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["name"], "Blood test")

    def test_duplicate_record_id_returns_clear_conflict(self):
        Record.objects.create(
            record_id=1700000000000002,
            patient_id=self.wallet,
            ipfs_hash="ipfs://existing",
            encrypted_key_ref="kms:existing",
            tx_hash="pending-existing",
        )

        response = self.client.post(
            "/api/v1/records/",
            {
                "record_id": 1700000000000002,
                "ipfs_hash": "ipfs://new",
                "encrypted_key_ref": "kms:new",
                "tx_hash": "pending-new",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["detail"], "Record already exists")

    def test_patient_can_download_uploaded_file(self):
        response = self.client.post(
            "/api/v1/records/",
            {
                "record_id": 1700000000000003,
                "ipfs_hash": "ipfs://record-download",
                "encrypted_key_ref": "kms:record-download",
                "name": "Lab report",
                "tx_hash": "pending-download",
                "file": SimpleUploadedFile("lab-report.pdf", b"%PDF-1.4 private patient data", content_type="application/pdf"),
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)

        downloaded = self.client.get("/api/v1/records/1700000000000003/download")

        self.assertEqual(downloaded.status_code, 200)
        self.assertEqual(b"".join(downloaded.streaming_content), b"%PDF-1.4 private patient data")

    def test_non_pdf_upload_is_rejected(self):
        response = self.client.post(
            "/api/v1/records/",
            {
                "record_id": 1700000000000006,
                "ipfs_hash": "ipfs://record-text",
                "encrypted_key_ref": "kms:record-text",
                "tx_hash": "pending-text",
                "file": SimpleUploadedFile("notes.txt", b"not a PDF", content_type="text/plain"),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("PDF", str(response.data["file"]))

    def test_other_patient_cannot_download_record(self):
        Record.objects.create(
            record_id=1700000000000004,
            patient_id=self.wallet,
            ipfs_hash="ipfs://private",
            encrypted_key_ref="kms:private",
            tx_hash="pending-private",
            uploaded_file=SimpleUploadedFile("private.pdf", b"%PDF-1.4 private", content_type="application/pdf"),
        )
        other_wallet = "0x0000000000000000000000000000000000000012"
        other_user = User.objects.create_user(username=other_wallet)
        UserProfile.objects.create(wallet=other_wallet, role=UserProfile.ROLE_PATIENT)
        self.client.force_authenticate(user=other_user)

        response = self.client.get("/api/v1/records/1700000000000004/download")

        self.assertEqual(response.status_code, 404)

    def test_legacy_record_download_requires_reupload(self):
        Record.objects.create(
            record_id=1700000000000005,
            patient_id=self.wallet,
            ipfs_hash="ipfs://legacy-record",
            encrypted_key_ref="kms:legacy",
            name="Legacy report",
            description="Stored before file persistence was enabled",
            tx_hash="pending-legacy",
        )

        response = self.client.get("/api/v1/records/1700000000000005/download")

        self.assertEqual(response.status_code, 404)
        self.assertIn("Re-upload", response.data["detail"])
