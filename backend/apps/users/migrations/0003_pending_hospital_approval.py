from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0002_alter_userprofile_role"),
    ]

    operations = [
        migrations.AlterField(
            model_name="userprofile",
            name="status",
            field=models.CharField(choices=[("active", "Active"), ("pending", "Pending hospital approval"), ("suspended", "Suspended")], default="active", max_length=16),
        ),
    ]