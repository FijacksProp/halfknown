# Halfknown creature portraits

Halfknown has seven nonhuman creature groups: Animal, Alien, Goblin, Vampire, Elf, Fae and Android. Human illustration avatars were retired. Each group now has two masculine-presenting and two feminine-presenting portraits. The app uses compact WebP files from [`web/public/avatars/portraits`](../web/public/avatars/portraits/); the full-size generated PNGs are in [`web/public/avatars/concepts`](../web/public/avatars/concepts/).

| Group | First pair | Second pair |
| --- | --- | --- |
| Animal | [Male](../web/public/avatars/concepts/animal-male.png) · [Female](../web/public/avatars/concepts/animal-female.png) | [Male](../web/public/avatars/concepts/animal-male-02.png) · [Female](../web/public/avatars/concepts/animal-female-02.png) |
| Alien | [Male](../web/public/avatars/concepts/alien-male.png) · [Female](../web/public/avatars/concepts/alien-female.png) | [Male](../web/public/avatars/concepts/alien-male-02.png) · [Female](../web/public/avatars/concepts/alien-female-02.png) |
| Goblin | [Male](../web/public/avatars/concepts/goblin-male.png) · [Female](../web/public/avatars/concepts/goblin-female.png) | [Male](../web/public/avatars/concepts/goblin-male-02.png) · [Female](../web/public/avatars/concepts/goblin-female-02.png) |
| Vampire | [Male](../web/public/avatars/concepts/vampire-male.png) · [Female](../web/public/avatars/concepts/vampire-female.png) | [Male](../web/public/avatars/concepts/vampire-male-02.png) · [Female](../web/public/avatars/concepts/vampire-female-02.png) |
| Elf | [Male](../web/public/avatars/concepts/elf-male.png) · [Female](../web/public/avatars/concepts/elf-female.png) | [Male](../web/public/avatars/concepts/elf-male-02.png) · [Female](../web/public/avatars/concepts/elf-female-02.png) |
| Fae | [Male](../web/public/avatars/concepts/fae-male.png) · [Female](../web/public/avatars/concepts/fae-female.png) | [Male](../web/public/avatars/concepts/fae-male-02.png) · [Female](../web/public/avatars/concepts/fae-female-02.png) |
| Android | [Male](../web/public/avatars/concepts/android-male.png) · [Female](../web/public/avatars/concepts/android-female.png) | [Male](../web/public/avatars/concepts/android-male-02.png) · [Female](../web/public/avatars/concepts/android-female-02.png) |

## Art direction and generation prompts

The first set used the shared prompt direction: “Use case: stylized-concept. Square profile avatar portrait for a social app. One original, clearly adult character with group-specific features. Hand-painted digital storybook illustration with subtle gouache texture, intentional contours, expressive face, warm portrait lighting, a soft simple backdrop, and a welcoming mood. Centered head and shoulders composed for a circular crop. No text, logos, watermarks or copyrighted character likenesses.”

The second set used: “Use case: stylized-concept. Asset type: Halfknown social app profile avatar, second portrait set. ONE original adult [character brief]. Sophisticated hand-painted editorial storybook portrait with subtle gouache and ink texture, expressive natural face, warm portrait lighting, tasteful contemporary clothing. Square head-and-shoulders composition with full hair/ears/head and shoulders safely within a centered circular crop; generous margins. Plain softly textured background. No text, logos, watermarks, other people, stars, glossy 3D, childish proportions or oversized eyes.” The character briefs varied species details, body shapes, skin and fur colors, facial features, hair and clothing across the seven groups. All second-set images were generated with ImageGen; originals were retained and 512-pixel WebP copies were exported for the app.

## Product behavior

Registration randomly assigns one nonhuman group and one matching portrait. Existing Human-group accounts are reassigned in migration `0006`. My Space lets a user choose only portraits in their assigned group. Creature portraits identify users in Quick Meet and as a badge in Discover. The main Discover image is a real uploaded photo, shown only after review and owner opt-in; signup and Quick Meet do not require one.
