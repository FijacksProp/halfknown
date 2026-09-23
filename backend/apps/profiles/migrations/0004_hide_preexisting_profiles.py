from django.db import migrations


def hide_preexisting_profiles(apps, schema_editor):
    apps.get_model("profiles", "Profile").objects.all().update(discoverable=False)


class Migration(migrations.Migration):
    dependencies = [("profiles", "0003_profile_bio_profile_discoverable")]
    operations = [migrations.RunPython(hide_preexisting_profiles, migrations.RunPython.noop)]
