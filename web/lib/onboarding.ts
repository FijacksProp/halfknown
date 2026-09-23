import type { Onboarding, Preferences } from './api.ts';

export const emptyPreferences = (): Preferences => ({
  genders: [],
  min_age: 18,
  max_age: 120,
  open_chat_opt_in: false,
});

export const emptyDraft = (): Onboarding => ({
  birth_date: '',
  gender: '',
  intentions: ['dating'],
  interests: [],
  languages: ['en'],
  conversation_style: 'playful',
  prompt_answer: '',
  accepted_terms: false,
  accepted_guidelines: false,
  policy_version: '',
  preferences: emptyPreferences(),
});

export function adultBirthDate(value: string, today = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const birthday = new Date(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(birthday.getTime()) ||
    birthday.toISOString().slice(0, 10) !== value
  )
    return false;
  let age = today.getUTCFullYear() - birthday.getUTCFullYear();
  if (
    today.getUTCMonth() < birthday.getUTCMonth() ||
    (today.getUTCMonth() === birthday.getUTCMonth() &&
      today.getUTCDate() < birthday.getUTCDate())
  )
    age -= 1;
  return age >= 18 && age <= 120;
}

export function validPreferences(prefs: Preferences): boolean {
  return (
    prefs.genders.length > 0 &&
    Number.isInteger(prefs.min_age) &&
    Number.isInteger(prefs.max_age) &&
    prefs.min_age >= 18 &&
    prefs.max_age <= 120 &&
    prefs.min_age <= prefs.max_age
  );
}

export function toggleChoice(
  values: string[],
  value: string,
  maximum = Infinity,
): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : values.length < maximum
      ? [...values, value]
      : values;
}

export function stepValid(step: number, draft: Onboarding): boolean {
  if (step === 1) return draft.intentions.length > 0;
  if (step === 2)
    return (
      adultBirthDate(draft.birth_date) &&
      !!draft.gender &&
      validPreferences(draft.preferences)
    );
  if (step === 3)
    return (
      draft.interests.length >= 3 &&
      draft.interests.length <= 5
    );
  return draft.accepted_terms && draft.accepted_guidelines;
}

export function label(value: string): string {
  const names: Record<string, string> = {
    nonbinary: 'Nonbinary',
    self_described: 'Self-described',
    undisclosed: 'Prefer not to say',
    conversation: 'Just talking',
  };
  return (
    names[value] ??
    value.replaceAll('-', ' ').replace(/^./, (letter) => letter.toUpperCase())
  );
}
