import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("access", "0005_appointment"),
        ("hospitals", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="emergencyaccessrequest",
            name="hospital",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="emergency_requests", to="hospitals.hospital"),
        ),
    ]