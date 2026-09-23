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
    "human": ("human-01", "human-02"),
    "animal": ("animal-01",),
    "alien": ("alien-01",),
    "goblin": ("goblin-01", "creature-01"),
    "vampire": ("vampire-01",),
}
AVATARS = tuple(avatar for group in AVATAR_GROUPS.values() for avatar in group)
STYLES = ("playful", "thoughtful", "deep", "lighthearted", "adventurous", "supportive")


def age_on(birth_date, today):
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
