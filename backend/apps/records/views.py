from django.http import FileResponse
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsActivePatient, get_request_profile

from .models import Record
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
        record, created = Record.objects.get_or_create(
            record_id=data["record_id"],
            defaults={
                "patient": profile,
                "ipfs_hash": data["ipfs_hash"],
                "encrypted_key_ref": data["encrypted_key_ref"],
                "uploaded_file": data.get("file"),
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
