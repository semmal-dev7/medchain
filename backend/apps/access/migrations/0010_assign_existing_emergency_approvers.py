from django.db import migrations


def assign_existing_emergency_approvers(apps, schema_editor):
    EmergencyAccessRequest = apps.get_model("access", "EmergencyAccessRequest")
    EmergencyRequestApprover = apps.get_model("access", "EmergencyRequestApprover")
    HospitalMembership = apps.get_model("hospitals", "HospitalMembership")

    for emergency_request in EmergencyAccessRequest.objects.filter(hospital__status="active").iterator():
        approver_ids = list(
            HospitalMembership.objects.filter(
                hospital_id=emergency_request.hospital_id,
                role="emergency_doctor",
                active=True,
                emergency_access=True,
                user__role="doctor",
                user__status="active",
                hospital__status="active",
            ).values_list("user_id", flat=True)
        )
        if len(approver_ids) != 3:
            continue
        EmergencyRequestApprover.objects.bulk_create([
            EmergencyRequestApprover(request_id=emergency_request.pk, approver_id=approver_id)
            for approver_id in approver_ids
        ])


class Migration(migrations.Migration):

    dependencies = [
        ("access", "0009_emergencyrequestapprover"),
        ("hospitals", "0004_hospitaldoctorrequest"),
    ]

    operations = [
        migrations.RunPython(assign_existing_emergency_approvers, migrations.RunPython.noop),
    ]
