from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("social", "0002_connection_declined"),
    ]

    operations = [
        migrations.AddField(
            model_name="connection",
            name="first_read_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="connection",
            name="second_read_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
