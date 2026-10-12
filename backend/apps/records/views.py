from django.http import FileResponse
from django.core.files.base import ContentFile
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsActivePatient, get_request_profile

from .models import Record
from .encryption import decrypt_file, encrypt_file
from .clinical import build_fhir_bundle, create_clinical_commitment
from .serializers import RecordCreateSerializer, RecordSerializer


class MyRecordsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActivePatient]

    def get(self, request):
        profile = get_request_profile(request)
        records = Record.objects.filter(patient=profile, active=True).order_by("-created_at")
        return Response(RecordSerializer(records, many=True).data)


class CreateRecordView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActivePatient]

    def post(self, request):
        serializer = RecordCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = get_request_profile(request)

        data = serializer.validated_data
        uploaded_file = data.get("file")
        encrypted_file = None
        original_file_name = ""
        if uploaded_file:
            encrypted_file = ContentFile(
                encrypt_file(uploaded_file.read()),
                name=f"{uploaded_file.name}.enc",
            )
            original_file_name = uploaded_file.name
        fhir_resources = data.get("fhir_resources", [])
        try:
            fhir_bundle = build_fhir_bundle(fhir_resources, profile.wallet, data["record_id"])
        except ValueError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        record, created = Record.objects.get_or_create(
            record_id=data["record_id"],
            defaults={
                "patient": profile,
                "ipfs_hash": data["ipfs_hash"],
                "encrypted_key_ref": data["encrypted_key_ref"],
                "encrypted_file": encrypted_file,
                "original_file_name": original_file_name,
                "fhir_bundle": fhir_bundle,
                "clinical_commitment": create_clinical_commitment(fhir_bundle),
                "commitment_algorithm": "sha256-v1",
                "name": data.get("name", ""),
                "description": data.get("description", ""),
                "tx_hash": data.get("tx_hash", ""),
            },
        )
        if not created:
            return Response({"detail": "Record already exists"}, status=status.HTTP_409_CONFLICT)

        return Response(RecordSerializer(record).data, status=status.HTTP_201_CREATED)


class DownloadRecordView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActivePatient]

    def get(self, request, record_id):
        profile = get_request_profile(request)
        record = Record.objects.filter(record_id=record_id, patient=profile, active=True).first()
        if not record:
            return Response({"detail": "Record not found"}, status=status.HTTP_404_NOT_FOUND)
        if record.encrypted_file:
            try:
                contents = decrypt_file(record.encrypted_file.open("rb").read())
            except Exception:
                return Response({"detail": "Stored medical file could not be decrypted"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            response = FileResponse(
                iter([contents]),
                as_attachment=True,
                filename=record.original_file_name or f"medical-record-{record.record_id}.pdf",
            )
            return response
        if not record.uploaded_file:
            return Response({"detail": "Original file is not stored. Re-upload the PDF to enable an identical download."}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(
            record.uploaded_file.open("rb"),
            as_attachment=True,
            filename=record.uploaded_file.name.rsplit("/", 1)[-1],
        )


class DeleteRecordView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActivePatient]

    def delete(self, request, record_id):
        profile = get_request_profile(request)
        record = Record.objects.filter(record_id=record_id, patient=profile, active=True).first()
        if not record:
            return Response({"detail": "Record not found"}, status=status.HTTP_404_NOT_FOUND)
        record.active = False
        record.save(update_fields=["active"])
        return Response(status=status.HTTP_204_NO_CONTENT)
