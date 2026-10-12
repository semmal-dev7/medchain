from rest_framework import permissions

from apps.users.permissions import get_request_profile

from .models import Hospital, HospitalMembership


class IsHospitalAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        profile = get_request_profile(request)
        hospital = getattr(view, "hospital", None)
        if hospital is None:
            hospital_id = view.kwargs.get("hospital_id")
            hospital = Hospital.objects.filter(id=hospital_id).first()
        return bool(
            profile
            and hospital
            and hospital.status == hospital.STATUS_ACTIVE
            and HospitalMembership.objects.filter(
                hospital=hospital,
                user=profile,
                role=HospitalMembership.ROLE_ADMIN,
                active=True,
            ).exists()
        )