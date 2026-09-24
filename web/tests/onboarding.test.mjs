import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  adultBirthDate,
  emptyDraft,
  emptyPreferences,
  stepValid,
  toggleChoice,
  validPreferences,
} from '../lib/onboarding.ts';

test('adult boundary checks use a complete, valid birth date', () => {
  const today = new Date('2026-09-14T12:00:00Z');
  assert.equal(adultBirthDate('2008-09-14', today), true);
  assert.equal(adultBirthDate('2008-09-15', today), false);
  for (const value of [
    '2027-01-01',
    '2000-02-30',
    '2000-13-01',
    '',
    '18',
    '1800-01-01',
  ]) {
    assert.equal(adultBirthDate(value, today), false);
  }
});

test('preferences require a choice, whole ages, and valid reciprocal range', () => {
  const prefs = { ...emptyPreferences(), genders: ['woman'] };
  assert.equal(validPreferences(prefs), true);
  for (const change of [
    { genders: [] },
    { min_age: 17 },
    { min_age: 40, max_age: 30 },
    { max_age: 121 },
    { min_age: NaN },
    { max_age: 30.5 },
  ]) {
    assert.equal(validPreferences({ ...prefs, ...change }), false);
  }
});

test('consent and Open Chat opt-in start unchecked', () => {
  const draft = emptyDraft();
  assert.equal(draft.accepted_terms, false);
  assert.equal(draft.accepted_guidelines, false);
  assert.equal(draft.preferences.open_chat_opt_in, false);
  assert.equal(stepValid(4, draft), false);
});

test('interest selection is reversible, unique, and capped at five', () => {
  assert.deepEqual(toggleChoice(['music'], 'music', 5), []);
  const five = ['music', 'books', 'art', 'travel', 'gaming'];
  assert.deepEqual(toggleChoice(five, 'films', 5), five);
  assert.deepEqual(toggleChoice([], 'music', 5), ['music']);
});

test('incomplete steps cannot move forward', () => {
  const draft = emptyDraft();
  assert.equal(stepValid(1, draft), false);
  assert.equal(stepValid(1, { ...draft, username: 'river_fox' }), true);
  assert.equal(stepValid(1, { ...draft, intentions: [] }), false);
  assert.equal(stepValid(2, draft), false);
  assert.equal(stepValid(3, draft), false);
  assert.equal(
    stepValid(3, {
      ...draft,
      interests: ['music', 'books', 'art'],
    }),
    true,
  );
});
