import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("users", "0002_alter_userprofile_role"),
    ]

    operations = [
        migrations.CreateModel(
            name="Hospital",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("wallet", models.CharField(max_length=42, unique=True)),
                ("name", models.CharField(max_length=200)),
                ("status", models.CharField(choices=[("active", "Active"), ("suspended", "Suspended")], default="active", max_length=16)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("registered_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="hospitals_registered", to="users.userprofile")),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="HospitalMembership",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(choices=[("admin", "Hospital admin"), ("doctor", "Doctor")], max_length=16)),
                ("active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("hospital", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="memberships", to="hospitals.hospital")),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="hospital_membership", to="users.userprofile")),
            ],
            options={
                "constraints": [models.UniqueConstraint(fields=("hospital", "user"), name="unique_hospital_membership")],
            },
        ),
    ]