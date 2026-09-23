import secrets

GENDERS = ("woman", "man", "nonbinary", "self_described", "undisclosed")
INTENTIONS = ("dating", "flirting", "friendship", "conversation")
INTERESTS = (
    "music",
    "films",
    "gaming",
    "books",
    "travel",
    "food",
    "tech",
    "fitness",
    "art",
    "late-night-talks",
    "big-questions",
    "comedy",
)
AVATAR_GROUPS = {
    group: (f"{group}-male", f"{group}-female")
    for group in ("human", "animal", "alien", "goblin", "vampire", "elf", "fae", "android")
}
AVATARS = tuple(avatar for group in AVATAR_GROUPS.values() for avatar in group)
STYLES = ("playful", "thoughtful", "deep", "lighthearted", "adventurous", "supportive")


def avatar_choices(group, gender):
    choices = AVATAR_GROUPS.get(group, ())
    if gender == "woman":
        return tuple(avatar for avatar in choices if avatar.endswith("-female"))
    if gender == "man":
        return tuple(avatar for avatar in choices if avatar.endswith("-male"))
    return choices


def assign_avatar(gender):
    group = secrets.choice(tuple(AVATAR_GROUPS))
    return group, secrets.choice(avatar_choices(group, gender))


def age_on(birth_date, today):
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
