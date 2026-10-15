import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("access", "0008_move_predicate_to_emergency_request"),
        ("users", "0002_alter_userprofile_role"),
    ]

    operations = [
        migrations.CreateModel(
            name="EmergencyRequestApprover",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "approver",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="emergency_request_assignments",
                        to="users.userprofile",
                    ),
                ),
                (
                    "request",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="approver_assignments",
                        to="access.emergencyaccessrequest",
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("request", "approver"),
                        name="unique_emergency_request_approver_assignment",
                    ),
                ],
            },
        ),
        migrations.AddField(
            model_name="emergencyaccessrequest",
            name="selected_approvers",
            field=models.ManyToManyField(
                related_name="emergency_requests_to_review",
                through="access.EmergencyRequestApprover",
                to="users.userprofile",
            ),
        ),
    ]
