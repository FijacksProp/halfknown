// Local-only random-chat smoke check. Creates three synthetic guest identities and one report.
// Run from web with both local servers active: node scripts/smoke-chat.mjs
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { createApi } from '../lib/api.ts';

const origin = 'http://127.0.0.1:3000';
const accounts = [];
const sockets = [];

async function account(gender) {
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
  const catalog = await api.catalog();
  const saved = await api.randomAccess({
    gender,
    adult_confirmed: true,
    accepted_terms: true,
    accepted_guidelines: true,
    policy_version: catalog.policy_version,
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
    throw new Error(`No ${type} event received through the frontend proxy.`);
  };
}

try {
  const a = await account('man');
  const b = await account('woman');
  const c = await account('undisclosed');
  const aEvent = await events(a);
  const bEvent = await events(b);
  await aEvent('connection.ready');
  await bEvent('connection.ready');

  assert.equal((await a.api.joinQueue()).state, 'waiting');
  const firstChat = await b.api.joinQueue();
  assert.equal(firstChat.state, 'active');
  assert.equal(firstChat.peer.alias, a.saved.profile.alias);
  assert.equal((await a.api.heartbeat()).peer.alias, b.saved.profile.alias);

  const clientId = crypto.randomUUID();
  const sent = await a.api.sendMessage(
    firstChat.id,
    clientId,
    'Hello from the random-chat smoke test.',
  );
  assert.equal(
    (await a.api.sendMessage(firstChat.id, clientId, sent.body)).id,
    sent.id,
  );
  await bEvent('chat.changed');
  assert.equal(
    (await b.api.messages(firstChat.id)).messages[0].body,
    sent.body,
  );
  await b.api.typing(firstChat.id);
  await aEvent('chat.typing');

  assert.equal((await c.api.joinQueue()).state, 'waiting');
  const nextChat = await a.api.nextPerson(firstChat.id);
  assert.equal(nextChat.state, 'active');
  assert.equal(nextChat.peer.alias, c.saved.profile.alias);
  assert.equal((await b.api.heartbeat()).state, 'waiting');
  assert.equal((await a.api.nextPerson(firstChat.id)).id, nextChat.id);

  await a.api.leaveChat();
  assert.equal((await a.api.heartbeat()).state, 'idle');
  assert.equal((await b.api.heartbeat()).state, 'active');
  assert.equal((await c.api.heartbeat()).state, 'active');

  await b.api.reportChat(
    firstChat.id,
    'other',
    'Synthetic smoke-test report; no real abuse.',
  );
  await assert.rejects(
    a.api.sendMessage(firstChat.id, crypto.randomUUID(), 'Must not send'),
    { status: 400 },
  );
  console.log(
    'PASS: guest entry → random instant match → messaging/typing → Next → automatic peer requeue → stale-action safety → report/block.',
  );
  console.log(
    'Three synthetic guest identities and one labeled test report remain in the local database.',
  );
} finally {
  for (const socket of sockets) socket.close();
  for (const api of accounts) {
    await api.leaveChat().catch(() => {});
    await api.logout().catch(() => {});
  }
}
