// Requires local file-email mode. Creates one synthetic account; do not use with real SMTP.
// Run with both local servers started: node scripts/smoke-onboarding.mjs
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createApi } from '../lib/api.ts';

const origin = 'http://127.0.0.1:3000';
const mailDirectory = new URL('../../backend/.local-mail/', import.meta.url);
const before = new Set(await readdir(mailDirectory));
const cookies = new Map();
const client = createApi(async (path, options) => {
  const headers = new Headers(options.headers);
  headers.set('Origin', origin);
  if (cookies.size)
    headers.set(
      'Cookie',
      [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
    );
  const response = await fetch(new URL(path, origin), { ...options, headers });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(';', 1)[0];
    const split = pair.indexOf('=');
    cookies.set(pair.slice(0, split), pair.slice(split + 1));
  }
  return response;
});

const email = `smoke-${crypto.randomUUID()}@example.com`;
const catalog = await client.catalog();
const challenge = await client.requestCode(email);
// Synchronous file-email local mode has written the code by the time requestCode returns.
let code;
for (const filename of await readdir(mailDirectory)) {
  if (before.has(filename)) continue;
  const content = await readFile(new URL(filename, mailDirectory), 'utf8');
  if (content.includes(email))
    code = /Your code is ([0-9]{6})/.exec(content)?.[1];
}
assert.ok(
  code,
  'No captured code found. Use Django local file-email mode, not a real SMTP provider.',
);
await client.verifyCode(challenge.challenge_id, code);
assert.equal((await client.me()).onboarding_complete, false);
const profile = await client.createProfile({
  birth_date: '2000-01-01',
  accepted_terms: true,
  accepted_guidelines: true,
  policy_version: catalog.policy_version,
  avatar_id: catalog.avatars[0],
  gender: 'undisclosed',
  intentions: ['friendship'],
  interests: ['music', 'books', 'art'],
  languages: ['en'],
  conversation_style: 'thoughtful',
  prompt_answer: '',
  preferences: {
    genders: ['woman', 'man', 'nonbinary', 'self_described', 'undisclosed'],
    min_age: 18,
    max_age: 50,
    open_chat_opt_in: false,
  },
});
assert.equal((await client.me()).onboarding_complete, true);
assert.equal((await client.profile()).profile.id, profile.profile.id);
assert.equal('birth_date' in profile.profile, false);
assert.equal('email' in profile.profile, false);
await client.savePreferences({
  ...profile.preferences,
  min_age: 25,
  open_chat_opt_in: true,
});
assert.equal((await client.profile()).preferences.min_age, 25);
await assert.rejects(client.verifyCode(challenge.challenge_id, code), {
  status: 400,
});
await client.logout();
await assert.rejects(client.me(), { status: 403 });
console.log(
  'PASS: frontend proxy → CSRF → email code → verified session → saved profile → preferences → logout.',
);
console.log(
  'One synthetic smoke account remains in the local database. No tokens or codes were printed.',
);
