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
# Stable asset IDs; character art will be produced in a later session.
AVATARS = ("human-01", "animal-01", "alien-01", "creature-01")
STYLES = ("playful", "thoughtful", "deep", "lighthearted", "adventurous", "supportive")


def age_on(birth_date, today):
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
