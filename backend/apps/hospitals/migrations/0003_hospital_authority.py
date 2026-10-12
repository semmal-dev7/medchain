import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("hospitals", "0002_membership_user_many_to_many"),
    ]

    operations = [
        migrations.AddField(
            model_name="hospitalmembership",
            name="emergency_access",
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name="HospitalEmergencyPolicy",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("allowed_predicates", models.JSONField(default=list)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("hospital", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="emergency_policy", to="hospitals.hospital")),
            ],
        ),
        migrations.CreateModel(
            name="HospitalPatientProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("hospital_patient_id", models.CharField(max_length=100)),
                ("administrative_notes", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("hospital", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="patient_profiles", to="hospitals.hospital")),
                ("patient", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="hospital_profiles", to="users.userprofile")),
            ],
        ),
        migrations.CreateModel(
            name="HospitalEncounter",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("encounter_type", models.CharField(max_length=100)),
                ("status", models.CharField(default="planned", max_length=32)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="hospital_encounters_created", to="users.userprofile")),
                ("patient_profile", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="encounters", to="hospitals.hospitalpatientprofile")),
            ],
        ),
        migrations.AddConstraint(
            model_name="hospitalpatientprofile",
            constraint=models.UniqueConstraint(fields=("hospital", "patient"), name="unique_hospital_patient"),
        ),
        migrations.AddConstraint(
            model_name="hospitalpatientprofile",
            constraint=models.UniqueConstraint(fields=("hospital", "hospital_patient_id"), name="unique_hospital_patient_id"),
        ),
    ]