from django.contrib import admin
from django.urls import include, path


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("apps.authn.urls")),
    path("api/v1/users/", include("apps.users.urls")),
    path("api/v1/records/", include("apps.records.urls")),
    path("api/v1/access/", include("apps.access.urls")),
]
