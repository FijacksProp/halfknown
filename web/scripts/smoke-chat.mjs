// Local file-email preview only. Creates three synthetic accounts and one report.
// Run from web: node scripts/smoke-chat.mjs
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import WebSocket from 'ws';
import { createApi } from '../lib/api.ts';

const origin = 'http://127.0.0.1:3000';
const mailDirectory = new URL('../../backend/.local-mail/', import.meta.url);
const accounts = [];
const sockets = [];

async function account() {
  const cookies = new Map();
  const api = createApi(async (path, options) => {
    const headers = new Headers(options.headers);
    headers.set('Origin', origin);
    headers.set(
      'Cookie',
      [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
    );
    const response = await fetch(new URL(path, origin), {
      ...options,
      headers,
    });
    for (const value of response.headers.getSetCookie()) {
      const pair = value.split(';', 1)[0];
      const index = pair.indexOf('=');
      cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return response;
  });
  accounts.push(api);
  const before = new Set(await readdir(mailDirectory));
  const email = `chat-smoke-${crypto.randomUUID()}@example.com`;
  const challenge = await api.requestCode(email);
  let code;
  for (const filename of await readdir(mailDirectory)) {
    if (before.has(filename)) continue;
    const contents = await readFile(new URL(filename, mailDirectory), 'utf8');
    if (contents.includes(email))
      code = /Your code is ([0-9]{6})/.exec(contents)?.[1];
  }
  assert.ok(
    code,
    'Use the local file-email backend; no captured code was found.',
  );
  await api.verifyCode(challenge.challenge_id, code);
  const catalog = await api.catalog();
  const saved = await api.createProfile({
    birth_date: '2000-01-01',
    accepted_terms: true,
    accepted_guidelines: true,
    policy_version: catalog.policy_version,
    avatar_id: catalog.avatars[0],
    gender: 'undisclosed',
    intentions: ['conversation'],
    interests: ['art', 'books', 'music'],
    languages: ['ja'],
    conversation_style: 'thoughtful',
    prompt_answer: '',
    preferences: {
      genders: ['undisclosed'],
      min_age: 18,
      max_age: 50,
      open_chat_opt_in: true,
    },
  });
  return { api, cookies, saved };
}

async function events(account) {
  const socket = new WebSocket('ws://127.0.0.1:3000/ws/events/', {
    headers: {
      Origin: origin,
      Cookie: [...account.cookies]
        .map(([key, value]) => `${key}=${value}`)
        .join('; '),
    },
  });
  sockets.push(socket);
  const buffer = [];
  socket.on('message', (data) => buffer.push(JSON.parse(data.toString())));
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  return async (type) => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const index = buffer.findIndex((event) => event.type === type);
      if (index >= 0) return buffer.splice(index, 1)[0];
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(
      `No ${type} notification received through the frontend proxy.`,
    );
  };
}

try {
  const a = await account();
  let b = await account();
  const aEvent = await events(a);
  let bEvent = await events(b);
  await aEvent('connection.ready');
  await bEvent('connection.ready');
  assert.equal(
    (await a.api.joinQueue('compatible', 'conversation')).state,
    'waiting',
  );
  let invitation = await b.api.joinQueue('compatible', 'conversation');
  assert.equal(invitation.state, 'invited');
  assert.equal(invitation.peer.alias, a.saved.profile.alias);
  assert.equal((await a.api.heartbeat()).peer.alias, b.saved.profile.alias);
  await aEvent('match.changed');
  await bEvent('match.changed');
  assert.equal((await a.api.declineChat(invitation.id)).state, 'waiting');
  assert.equal((await b.api.heartbeat()).state, 'waiting');
  assert.equal((await a.api.heartbeat()).state, 'waiting');
  await b.api.leaveChat();
  assert.equal((await b.api.declineChat(invitation.id)).state, 'idle');
  // A stays in the same queue and matches a third person, not the declined pair.
  b = await account();
  bEvent = await events(b);
  await bEvent('connection.ready');
  invitation = await b.api.joinQueue('compatible', 'conversation');
  assert.equal(invitation.state, 'invited');
  assert.equal(invitation.peer.alias, a.saved.profile.alias);
  assert.equal((await a.api.acceptChat(invitation.id)).state, 'invited');
  assert.equal((await b.api.acceptChat(invitation.id)).state, 'active');
  const clientId = crypto.randomUUID();
  const sent = await a.api.sendMessage(
    invitation.id,
    clientId,
    'Hello from the local smoke test.',
  );
  assert.equal(
    (await a.api.sendMessage(invitation.id, clientId, sent.body)).id,
    sent.id,
  );
  await bEvent('chat.changed');
  const received = await b.api.messages(invitation.id);
  assert.equal(received.messages.length, 1);
  assert.equal(received.messages[0].mine, false);
  await b.api.typing(invitation.id);
  await aEvent('chat.typing');
  await b.api.sendMessage(
    invitation.id,
    crypto.randomUUID(),
    'Reply received.',
  );
  assert.equal(
    (await a.api.messages(invitation.id, sent.id)).messages.length,
    1,
  );
  assert.equal((await a.api.nextPerson(invitation.id)).state, 'waiting');
  assert.equal((await b.api.heartbeat()).state, 'idle');
  await a.api.leaveChat();
  assert.equal((await a.api.nextPerson(invitation.id)).state, 'idle');
  await b.api.reportChat(
    invitation.id,
    'other',
    'Synthetic smoke-test report; no real abuse.',
  );
  assert.equal((await a.api.heartbeat()).state, 'idle');
  assert.equal(
    (await a.api.messages(invitation.id)).conversation.state,
    'ended',
  );
  await assert.rejects(
    a.api.sendMessage(invitation.id, crypto.randomUUID(), 'Must not send'),
    { status: 400 },
  );
  console.log(
    'PASS: decline → automatic requeue → no repeat pairing → third-person match → chat/typing → next person → stop → stale retry safety → report/block.',
  );
  console.log(
    'Three synthetic accounts and one clearly labeled test report remain in the local database. No credentials printed.',
  );
} finally {
  for (const socket of sockets) socket.close();
  for (const api of accounts) {
    await api.leaveChat().catch(() => {});
    await api.logout().catch(() => {});
  }
}
