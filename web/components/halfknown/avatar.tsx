export const avatarOptions = [
  { id: 'human-01', label: 'The human', group: 'Human' },
  { id: 'animal-01', label: 'The animal', group: 'Animal' },
  { id: 'alien-01', label: 'The alien', group: 'Alien' },
  { id: 'goblin-01', label: 'The goblin', group: 'Goblin' },
  { id: 'vampire-01', label: 'The vampire', group: 'Vampire' },
  { id: 'human-02', label: 'The artist', group: 'Human' },
] as const;

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
      className={`character-avatar character-avatar--${id} character-avatar--${size} ${className}`}
    />
  );
}
