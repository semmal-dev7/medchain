from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("records", "0003_record_encrypted_file"),
    ]

    operations = [
        migrations.AddField(
            model_name="record",
            name="fhir_bundle",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="record",
            name="clinical_commitment",
            field=models.CharField(blank=True, default="", max_length=66),
        ),
        migrations.AddField(
            model_name="record",
            name="commitment_algorithm",
            field=models.CharField(default="sha256-v1", max_length=32),
        ),
    ]