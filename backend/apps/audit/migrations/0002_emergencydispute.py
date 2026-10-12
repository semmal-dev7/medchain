import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("access", "0008_move_predicate_to_emergency_request"),
        ("audit", "0001_initial"),
        ("users", "0002_alter_userprofile_role"),
    ]

    operations = [
        migrations.CreateModel(
            name="EmergencyDispute",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reason", models.TextField()),
                ("status", models.CharField(choices=[("open", "Open"), ("investigating", "Investigating"), ("resolved", "Resolved")], default="open", max_length=24)),
                ("resolution", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("reported_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="emergency_disputes", to="users.userprofile")),
                ("request", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="disputes", to="access.emergencyaccessrequest")),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]