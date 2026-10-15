from rest_framework import permissions

from apps.hospitals.emergency_policy import emergency_committee

from .models import UserProfile


def get_request_profile(request):
    wallet = (request.user.username or "").lower()
    return UserProfile.objects.filter(wallet=wallet).first()


class IsActivePatient(permissions.BasePermission):
    def has_permission(self, request, view):
        profile = get_request_profile(request)
        return bool(
            profile
            and profile.role == UserProfile.ROLE_PATIENT
            and profile.status == UserProfile.STATUS_ACTIVE
        )


class IsActiveDoctor(permissions.BasePermission):
    def has_permission(self, request, view):
        profile = get_request_profile(request)
        return bool(
            profile
            and profile.role == UserProfile.ROLE_DOCTOR
            and profile.status == UserProfile.STATUS_ACTIVE
        )


class IsActiveAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        profile = get_request_profile(request)
        return bool(
            profile
            and profile.role == UserProfile.ROLE_ADMIN
            and profile.status == UserProfile.STATUS_ACTIVE
        )


class IsActiveEmergencyApprover(permissions.BasePermission):
    def has_permission(self, request, view):
        profile = get_request_profile(request)
        if not profile or profile.status != UserProfile.STATUS_ACTIVE:
            return False
        return emergency_committee().filter(user=profile).exists()
