import hashlib
import secrets
from datetime import timedelta

from django.utils import timezone

from apps.hospitals.models import HospitalMembership
from apps.users.models import UserProfile

from .models import EmergencyAccessGrant, EmergencyAccessRequest

TEMPORARY_ACCESS_MINUTES = 30


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def issue_temporary_grant(request_obj: EmergencyAccessRequest) -> tuple[EmergencyAccessGrant, str]:
    now = timezone.now()
    expires_at = now + timedelta(minutes=TEMPORARY_ACCESS_MINUTES)
    token = secrets.token_urlsafe(32)
    grant, _ = EmergencyAccessGrant.objects.update_or_create(
        request=request_obj,
        defaults={
            "token_digest": _digest(token),
            "resources": request_obj.requested_resources,
            "expires_at": expires_at,
            "revoked_at": None,
        },
    )
    request_obj.expires_at = expires_at
    request_obj.save(update_fields=["expires_at"])
    return grant, token


def validate_temporary_grant(token: str) -> EmergencyAccessGrant | None:
    if not token:
        return None
    grant = EmergencyAccessGrant.objects.select_related("request", "request__doctor").filter(
        token_digest=_digest(token),
        revoked_at__isnull=True,
    ).first()
    if not grant:
        return None
    if grant.expires_at <= timezone.now():
        if grant.request.status == EmergencyAccessRequest.STATUS_APPROVED:
            grant.request.status = EmergencyAccessRequest.STATUS_EXPIRED
            grant.request.save(update_fields=["status"])
        return None
    if grant.request.status != EmergencyAccessRequest.STATUS_APPROVED:
        return None
    if not grant.request.hospital or grant.request.hospital.status != "active":
        return None
    if grant.request.doctor.status != UserProfile.STATUS_ACTIVE:
        return None
    if not HospitalMembership.objects.filter(
        hospital=grant.request.hospital,
        user=grant.request.doctor,
        active=True,
        emergency_access=True,
        hospital__status="active",
    ).exists():
        return None
    return grant