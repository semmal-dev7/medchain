import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("hospitals", "0003_hospital_authority"),
    ]

    operations = [
        migrations.CreateModel(
            name="HospitalDoctorRequest",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("requested_role", models.CharField(choices=[("doctor", "Doctor"), ("emergency_doctor", "Emergency doctor")], max_length=16)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected")], default="pending", max_length=16)),
                ("reason", models.TextField(blank=True, default="")),
                ("requested_at", models.DateTimeField(auto_now_add=True)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("doctor", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="hospital_doctor_requests", to="users.userprofile")),
                ("hospital", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="doctor_requests", to="hospitals.hospital")),
                ("reviewed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="hospital_requests_reviewed", to="users.userprofile")),
            ],
        ),
        migrations.AddConstraint(
            model_name="hospitaldoctorrequest",
            constraint=models.UniqueConstraint(condition=models.Q(status="pending"), fields=("hospital", "doctor"), name="unique_pending_hospital_doctor_request"),
        ),
    ]