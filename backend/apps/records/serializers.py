import os

from rest_framework import serializers

from .models import Record


class RecordSerializer(serializers.ModelSerializer):
    patient_wallet = serializers.CharField(source="patient.wallet", read_only=True)
    has_file = serializers.SerializerMethodField()

    def get_has_file(self, obj):
        return bool(obj.uploaded_file)

    class Meta:
        model = Record
        fields = (
            "id",
            "record_id",
            "patient_wallet",
            "ipfs_hash",
            "encrypted_key_ref",
            "name",
            "description",
            "active",
            "tx_hash",
            "created_at",
            "has_file",
        )


class RecordCreateSerializer(serializers.Serializer):
    record_id = serializers.IntegerField(min_value=0)
    ipfs_hash = serializers.CharField()
    encrypted_key_ref = serializers.CharField()
    name = serializers.CharField(required=False, allow_blank=True, max_length=200)
    description = serializers.CharField(required=False, allow_blank=True)
    tx_hash = serializers.CharField(required=False, allow_blank=True, max_length=66)
    file = serializers.FileField(required=False, write_only=True)

    def validate_file(self, value):
        extension = os.path.splitext(value.name)[1].lower()
        content_type = getattr(value, "content_type", "")
        if extension != ".pdf" or content_type not in ("application/pdf", ""):
            raise serializers.ValidationError("Medical records must be uploaded as PDF files")
        return value
