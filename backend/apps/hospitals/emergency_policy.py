from .models import Hospital, HospitalMembership
from apps.users.models import UserProfile

EMERGENCY_REQUEST_APPROVER_COUNT = 3
EMERGENCY_APPROVAL_THRESHOLD = 2
EMERGENCY_APPROVAL_WINDOW_MINUTES = 30


def emergency_committee(hospital=None):
    committee = HospitalMembership.objects.filter(
        active=True,
        emergency_access=True,
        user__role=UserProfile.ROLE_DOCTOR,
        user__status=UserProfile.STATUS_ACTIVE,
        hospital__status=Hospital.STATUS_ACTIVE,
    )
    if hospital:
        committee = committee.filter(hospital=hospital)
    return committee
