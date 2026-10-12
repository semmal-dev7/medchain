from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("access", "0006_emergencyaccessrequest_hospital"),
    ]

    operations = [
        migrations.AddField(
            model_name="emergencyaccessrequest",
            name="predicate",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
    ]