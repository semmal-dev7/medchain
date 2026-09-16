from rest_framework import serializers


class NonceRequestSerializer(serializers.Serializer):
    wallet = serializers.CharField(max_length=42)


class VerifyRequestSerializer(serializers.Serializer):
    wallet = serializers.CharField(max_length=42)
    message = serializers.CharField()
    signature = serializers.CharField()
    role = serializers.ChoiceField(choices=["patient", "doctor", "admin"], required=False)
    full_name = serializers.CharField(max_length=160, required=False, allow_blank=True)
