from django.urls import path

from .views import CreateEmergencyDisputeView, HospitalDisputeView, HospitalEmergencyAuditView


urlpatterns = [
    path("emergency/disputes", CreateEmergencyDisputeView.as_view(), name="emergency-dispute-create"),
    path("hospitals/<uuid:hospital_id>/emergency", HospitalEmergencyAuditView.as_view(), name="hospital-emergency-audit"),
    path("hospitals/<uuid:hospital_id>/disputes/<int:dispute_id>", HospitalDisputeView.as_view(), name="hospital-dispute-update"),
]