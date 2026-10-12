from django.urls import path

from .views import (
    HospitalDetailView,
    HospitalDoctorDetailView,
    HospitalDoctorRegistrationView,
    HospitalListCreateView,
    HospitalAdminListView,
    HospitalPatientProfileView,
    HospitalPolicyView,
    HospitalPublicAuditView,
    CreateDoctorHospitalRequestView,
    DoctorHospitalRequestsView,
    HospitalDoctorRequestsView,
    ReviewHospitalDoctorRequestView,
)


urlpatterns = [
    path("", HospitalListCreateView.as_view(), name="hospital-list-create"),
    path("mine", HospitalAdminListView.as_view(), name="hospital-admin-list"),
    path("<uuid:hospital_id>", HospitalDetailView.as_view(), name="hospital-detail"),
    path("<uuid:hospital_id>/doctors", HospitalDoctorRegistrationView.as_view(), name="hospital-doctor-register"),
    path("<uuid:hospital_id>/doctors/<str:doctor_wallet>", HospitalDoctorDetailView.as_view(), name="hospital-doctor-detail"),
    path("<uuid:hospital_id>/policy", HospitalPolicyView.as_view(), name="hospital-policy"),
    path("<uuid:hospital_id>/patients", HospitalPatientProfileView.as_view(), name="hospital-patient-profile"),
    path("<uuid:hospital_id>/public-audit", HospitalPublicAuditView.as_view(), name="hospital-public-audit"),
    path("doctor-requests", CreateDoctorHospitalRequestView.as_view(), name="doctor-hospital-request-create"),
    path("doctor-requests/mine", DoctorHospitalRequestsView.as_view(), name="doctor-hospital-requests-mine"),
    path("<uuid:hospital_id>/doctor-requests", HospitalDoctorRequestsView.as_view(), name="hospital-doctor-requests"),
    path("<uuid:hospital_id>/doctor-requests/<uuid:request_id>/<str:decision>", ReviewHospitalDoctorRequestView.as_view(), name="hospital-doctor-request-review"),
]