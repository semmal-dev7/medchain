from django.urls import path

from .views import NonceView, VerifyView


urlpatterns = [
    path("nonce", NonceView.as_view(), name="auth-nonce"),
    path("verify", VerifyView.as_view(), name="auth-verify"),
]
