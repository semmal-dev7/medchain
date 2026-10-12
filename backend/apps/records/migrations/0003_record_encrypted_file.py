from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("records", "0002_record_uploaded_file"),
    ]

    operations = [
        migrations.AddField(
            model_name="record",
            name="encrypted_file",
            field=models.FileField(blank=True, null=True, upload_to="encrypted_medical_records/"),
        ),
        migrations.AddField(
            model_name="record",
            name="original_file_name",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]