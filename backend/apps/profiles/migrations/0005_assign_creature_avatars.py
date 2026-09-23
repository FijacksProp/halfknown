import secrets

from django.db import migrations, models

GROUPS = ("human", "animal", "alien", "goblin", "vampire", "elf", "fae", "android")


def assign_existing_avatars(apps, schema_editor):
    Profile = apps.get_model("profiles", "Profile")
    database = schema_editor.connection.alias
    for profile in Profile.objects.using(database).all().iterator(chunk_size=500):
        if profile.avatar_group in GROUPS and profile.avatar_id in (
            f"{profile.avatar_group}-male",
            f"{profile.avatar_group}-female",
        ):
            continue
        group = secrets.choice(GROUPS)
        if profile.gender == "woman":
            presentation = "female"
        elif profile.gender == "man":
            presentation = "male"
        else:
            presentation = secrets.choice(("male", "female"))
        profile.avatar_group = group
        profile.avatar_id = f"{group}-{presentation}"
        profile.save(update_fields=["avatar_group", "avatar_id"])


class Migration(migrations.Migration):
    dependencies = [("profiles", "0004_hide_preexisting_profiles")]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="avatar_group",
            field=models.CharField(default="", editable=False, max_length=16),
        ),
        migrations.RunPython(assign_existing_avatars, migrations.RunPython.noop),
    ]
