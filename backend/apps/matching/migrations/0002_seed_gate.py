from django.db import migrations


def seed(apps, schema_editor):
    apps.get_model("matching", "MatchGate").objects.get_or_create(pk=1)


class Migration(migrations.Migration):
    dependencies = [("matching", "0001_initial")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
