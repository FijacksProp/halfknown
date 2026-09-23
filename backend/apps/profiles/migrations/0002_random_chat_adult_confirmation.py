from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("profiles", "0001_initial")]

    operations = [
        migrations.AlterField(
            model_name="privateprofile",
            name="birth_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="privateprofile",
            name="adult_confirmed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
