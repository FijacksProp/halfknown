const creatureGroups = [
  'human', 'animal', 'alien', 'goblin', 'vampire', 'elf', 'fae', 'android',
] as const;

const portraitIds = new Set(
  creatureGroups.flatMap((group) => [`${group}-male`, `${group}-female`]),
);

export function Avatar({
  id,
  size = 'medium',
  className = '',
}: {
  id: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`character-avatar ${portraitIds.has(id) ? 'character-avatar--portrait' : `character-avatar--${id}`} character-avatar--${size} ${className}`}
      style={portraitIds.has(id) ? { backgroundImage: `url('/avatars/portraits/${id}.webp')` } : undefined}
    />
  );
}
