from django.contrib.auth.models import User
from rest_framework import permissions, status
from rest_framework.serializers import Serializer, ChoiceField, CharField
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import UserProfile
from .serializers import UserProfileSerializer


def _wallet_from_user(user: User) -> str:
    return (user.username or "").lower()


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        wallet = _wallet_from_user(request.user)
        profile = UserProfile.objects.filter(wallet=wallet).first()
        if not profile:
            return Response({"detail": "Profile not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(UserProfileSerializer(profile).data)


class RegisterProfileInputSerializer(Serializer):
    role = ChoiceField(choices=[UserProfile.ROLE_PATIENT, UserProfile.ROLE_DOCTOR, UserProfile.ROLE_ADMIN])
    full_name = CharField(required=False, allow_blank=True, max_length=160)


class RegisterProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        wallet = _wallet_from_user(request.user)
        serializer = RegisterProfileInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        profile, created = UserProfile.objects.get_or_create(
            wallet=wallet,
            defaults={
                "role": data["role"],
                "full_name": data.get("full_name", ""),
            },
        )
        if not created:
            return Response({"detail": "Profile already exists"}, status=status.HTTP_409_CONFLICT)

        return Response(UserProfileSerializer(profile).data, status=status.HTTP_201_CREATED)
