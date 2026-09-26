import secrets

from django.db import migrations, models

GROUPS = ("animal", "alien", "goblin", "vampire", "elf", "fae", "android")


def retire_human_avatars(apps, schema_editor):
    Profile = apps.get_model("profiles", "Profile")
    database = schema_editor.connection.alias
    for profile in Profile.objects.using(database).all().iterator(chunk_size=500):
        changes = []
        if profile.avatar_group == "human" or profile.avatar_id.startswith("human-"):
            group = secrets.choice(GROUPS)
            presentation = (
                "female"
                if profile.gender == "woman"
                else "male"
                if profile.gender == "man"
                else secrets.choice(("male", "female"))
            )
            profile.avatar_group = group
            profile.avatar_id = f"{group}-{presentation}"
            changes.extend(("avatar_group", "avatar_id"))
        if profile.discoverable:
            profile.discoverable = False
            changes.append("discoverable")
        if changes:
            profile.save(update_fields=changes)


class Migration(migrations.Migration):
    dependencies = [("profiles", "0005_assign_creature_avatars")]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="photo",
            field=models.ImageField(blank=True, upload_to="profile-photos/"),
        ),
        migrations.AddField(
            model_name="profile",
            name="photo_status",
            field=models.CharField(
                choices=[
                    ("none", "No photo"),
                    ("pending", "Pending review"),
                    ("approved", "Approved"),
                    ("rejected", "Rejected"),
                ],
                default="none",
                max_length=12,
            ),
        ),
        migrations.RunPython(retire_human_avatars, migrations.RunPython.noop),
    ]
