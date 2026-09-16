from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models import UserProfile
from apps.users.serializers import UserProfileSerializer

from .models import AuthNonce
from .serializers import NonceRequestSerializer, VerifyRequestSerializer
from .services import generate_nonce, normalize_wallet, verify_siwe_signature


class NonceView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = NonceRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        wallet = normalize_wallet(serializer.validated_data["wallet"])
        if not wallet:
            return Response({"detail": "Invalid wallet address"}, status=status.HTTP_400_BAD_REQUEST)

        nonce = generate_nonce()
        AuthNonce.objects.update_or_create(
            wallet=wallet.lower(),
            defaults={
                "nonce": nonce,
                "expires_at": timezone.now() + timedelta(minutes=10),
            },
        )
        return Response({"nonce": nonce})


class VerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = VerifyRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        normalized_wallet = normalize_wallet(serializer.validated_data["wallet"])
        if not normalized_wallet:
            return Response({"detail": "Invalid wallet address"}, status=status.HTTP_400_BAD_REQUEST)
        wallet = normalized_wallet.lower()
        message = serializer.validated_data["message"]
        signature = serializer.validated_data["signature"]
        role = serializer.validated_data.get("role")
        full_name = serializer.validated_data.get("full_name", "")

        nonce_obj = AuthNonce.objects.filter(wallet=wallet).first()
        if not nonce_obj or nonce_obj.expires_at < timezone.now():
            return Response({"detail": "Nonce expired or not found"}, status=status.HTTP_401_UNAUTHORIZED)

        if not verify_siwe_signature(wallet, message, signature, nonce_obj.nonce):
            return Response({"detail": "Invalid signature"}, status=status.HTTP_401_UNAUTHORIZED)

        is_registration = role is not None
        profile = UserProfile.objects.filter(wallet=wallet).first()
        if not is_registration and not profile:
            return Response({"detail": "Account not registered"}, status=status.HTTP_404_NOT_FOUND)

        user, _ = User.objects.get_or_create(username=wallet, defaults={"email": f"{wallet}@wallet.local"})
        if profile and is_registration:
            profile.role = role
            profile.full_name = full_name
            profile.save(update_fields=["role", "full_name", "updated_at"])
        elif not profile:
            profile = UserProfile.objects.create(wallet=wallet, role=role, full_name=full_name)
        if profile.status == UserProfile.STATUS_SUSPENDED:
            return Response({"detail": "User suspended"}, status=status.HTTP_403_FORBIDDEN)

        refresh = RefreshToken.for_user(user)
        nonce_obj.delete()

        return Response(
            {
                "accessToken": str(refresh.access_token),
                "refreshToken": str(refresh),
                "user": UserProfileSerializer(profile).data,
            }
        )
