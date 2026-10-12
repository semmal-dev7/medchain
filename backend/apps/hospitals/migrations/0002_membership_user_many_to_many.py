from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("hospitals", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="hospitalmembership",
            name="user",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="hospital_memberships",
                to="users.userprofile",
            ),
        ),
    ]