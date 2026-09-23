# Halfknown character avatar samples

Sixteen square concept portraits: one masculine-presenting and one feminine-presenting sample for each group. The images are saved individually in [`web/public/avatars/concepts`](../web/public/avatars/concepts/).

| Group | Masculine-presenting | Feminine-presenting |
| --- | --- | --- |
| Human | [Open sample](../web/public/avatars/concepts/human-male.png) | [Open sample](../web/public/avatars/concepts/human-female.png) |
| Animal / Beast | [Open sample](../web/public/avatars/concepts/animal-male.png) | [Open sample](../web/public/avatars/concepts/animal-female.png) |
| Alien | [Open sample](../web/public/avatars/concepts/alien-male.png) | [Open sample](../web/public/avatars/concepts/alien-female.png) |
| Goblin | [Open sample](../web/public/avatars/concepts/goblin-male.png) | [Open sample](../web/public/avatars/concepts/goblin-female.png) |
| Vampire | [Open sample](../web/public/avatars/concepts/vampire-male.png) | [Open sample](../web/public/avatars/concepts/vampire-female.png) |
| Elf | [Open sample](../web/public/avatars/concepts/elf-male.png) | [Open sample](../web/public/avatars/concepts/elf-female.png) |
| Fae | [Open sample](../web/public/avatars/concepts/fae-male.png) | [Open sample](../web/public/avatars/concepts/fae-female.png) |
| Android / Robot | [Open sample](../web/public/avatars/concepts/android-male.png) | [Open sample](../web/public/avatars/concepts/android-female.png) |

## Prompt direction

Use case: stylized-concept. Asset type: square profile avatar portrait for a social app. Each prompt described one original, clearly adult character with a masculine or feminine presentation and group-specific features. Shared art direction: hand-painted digital storybook illustration with subtle gouache texture, intentional contours, expressive faces, warm portrait lighting, soft simple backdrops, and a welcoming mood. Each portrait was requested as a centered 1:1 head-and-shoulders image composed for a circular crop, with identifying features kept inside a central circle-safe area. No text, logos, watermarks, props, or copyrighted character likenesses.

Character briefs: diverse contemporary humans; an anthropomorphic fox and cat; indigo and teal aliens; moss and olive goblins; warm- and brown-skinned vampires; brown- and fair-skinned elves; two fae with subtle freckles and folded wings; and two humanlike androids with understated synthetic seams.

Generated with the built-in ImageGen tool. These are the first 16 portraits, not the final 80-image catalog. Smaller WebP copies used by the app live in [`web/public/avatars/portraits`](../web/public/avatars/portraits/); the original PNGs remain here.

## Current product behavior

Registration assigns and saves a random creature group with a portrait fitting the selected gender. Existing users receive a random group and portrait through a data migration. My Space shows avatar management at the bottom and permits only portraits from the assigned group. With one portrait per binary gender per group so far, those users see their current portrait until more images are made; users who select another gender or do not disclose one can choose either presentation within their group.
