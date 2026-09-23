from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("social", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="connection",
            name="status",
            field=models.CharField(
                choices=[("pending", "Pending"), ("accepted", "Accepted"), ("declined", "Declined")],
                max_length=12,
            ),
        ),
    ]
