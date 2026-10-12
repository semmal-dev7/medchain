from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("access", "0007_emergencyaccessrequest_predicate"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[],
        ),
    ]