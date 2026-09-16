from django.urls import path

from .views import MeView, RegisterProfileView


urlpatterns = [
    path("me", MeView.as_view(), name="users-me"),
    path("register", RegisterProfileView.as_view(), name="users-register"),
]
