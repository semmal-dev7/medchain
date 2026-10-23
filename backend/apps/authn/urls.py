from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import NonceView, VerifyView


urlpatterns = [
    path("nonce", NonceView.as_view(), name="auth-nonce"),
    path("verify", VerifyView.as_view(), name="auth-verify"),
    path("token/refresh", TokenRefreshView.as_view(), name="token-refresh"),
]
