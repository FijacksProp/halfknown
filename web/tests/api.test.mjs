import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, createApi } from '../lib/api.ts';

function harness(responses) {
  const calls = [];
  const api = createApi(async (url, options) => {
    calls.push({ url, ...options });
    const response = responses.shift();
    if (!response) throw new Error('Unexpected request');
    return response;
  });
  return { api, calls };
}
const json = (body, status = 200) => Response.json(body, { status });

test('decline and next preserve server-owned requeue state', async () => {
  const waiting = {
    state: 'waiting',
    mode: 'random',
    intention: 'conversation',
  };
  const { api, calls } = harness([
    json({ csrf_token: 't' }),
    json(waiting),
    json({ csrf_token: 't' }),
    json(waiting),
  ]);
  assert.deepEqual(await api.declineChat('old-chat'), waiting);
  assert.deepEqual(await api.nextPerson('old-chat'), waiting);
  assert.equal(calls[1].url, '/api/v1/chats/old-chat/decline/');
  assert.equal(calls[3].url, '/api/v1/chats/old-chat/next/');
  assert.equal(calls[1].method, 'POST');
});

test('chat commands use session-bound CSRF writes and exact conversation endpoints', async () => {
  const { api, calls } = harness(
    Array.from({ length: 8 }, () => [
      json({ csrf_token: 'chat-token' }),
      json({ state: 'idle' }),
    ]).flat(),
  );
  await api.joinQueue();
  await api.heartbeat();
  await api.acceptChat('chat-id');
  await api.sendMessage('chat-id', 'retry-id', 'Hello');
  await api.typing('chat-id');
  await api.blockChat('chat-id');
  await api.reportChat('chat-id', 'spam', 'Review this');
  await api.leaveChat();
  assert.equal(calls.length, 16);
  assert.equal(calls[1].url, '/api/v1/matching/queue/');
  assert.deepEqual(JSON.parse(calls[1].body), {});
  assert.equal(calls[7].url, '/api/v1/chats/chat-id/messages/');
  assert.deepEqual(JSON.parse(calls[7].body), {
    client_id: 'retry-id',
    body: 'Hello',
  });
  assert.equal(calls[13].url, '/api/v1/chats/chat-id/report/');
  assert.equal(calls[15].method, 'DELETE');
  for (let index = 1; index < calls.length; index += 2)
    assert.equal(calls[index].headers.get('X-CSRFToken'), 'chat-token');
});

test('guest-first access sends adult consent without requiring an email', async () => {
  const result = {
    account: { id: 'guest', email: '', is_guest: true },
    profile: { alias: 'QuietComet' },
    preferences: {},
  };
  const { api, calls } = harness([
    json({ csrf_token: 'guest-token' }),
    json(result, 201),
  ]);
  assert.deepEqual(
    await api.randomAccess({
      gender: 'undisclosed',
      adult_confirmed: true,
      accepted_terms: true,
      accepted_guidelines: true,
      policy_version: 'launch-1',
    }),
    result,
  );
  assert.equal(calls[1].url, '/api/v1/random-access/');
  assert.equal(JSON.parse(calls[1].body).adult_confirmed, true);
  assert.equal(JSON.parse(calls[1].body).email, undefined);
});

test('social discovery and connection calls use the intended routes', async () => {
  const { api, calls } = harness([
    json({ results: [], next_offset: null }),
    json({ csrf_token: 't' }),
    json({ status: 'pending' }, 201),
    json({ results: [] }),
    json({ csrf_token: 't' }),
    json({ body: 'Hello' }, 201),
    json({ csrf_token: 't' }),
    json({ status: 'accepted' }),
  ]);
  await api.discover({ interest: 'music', group: 'alien' });
  await api.connect('profile-id');
  await api.socialMessages('connection-id', 4);
  await api.sendSocialMessage('connection-id', 'Hello');
  await api.quickConnect('chat-id');
  assert.equal(
    calls[0].url,
    '/api/v1/social/discover/?interest=music&group=alien',
  );
  assert.equal(calls[2].url, '/api/v1/social/profiles/profile-id/connect/');
  assert.equal(
    calls[3].url,
    '/api/v1/social/connections/connection-id/messages/?after=4',
  );
  assert.equal(
    calls[5].url,
    '/api/v1/social/connections/connection-id/messages/',
  );
  assert.deepEqual(JSON.parse(calls[5].body), { body: 'Hello' });
  assert.equal(calls[7].url, '/api/v1/chats/chat-id/connect/');
  for (const index of [2, 5, 7])
    assert.equal(calls[index].headers.get('X-CSRFToken'), 't');
});

test('quick chat can read and decline an incoming keep-in-touch request', async () => {
  const incoming = {
    id: 'request-id',
    status: 'pending',
    direction: 'incoming',
  };
  const { api, calls } = harness([
    json({ connection: incoming }),
    json({ csrf_token: 't' }),
    new Response(null, { status: 204 }),
  ]);
  assert.deepEqual(await api.quickConnectionState('chat-id'), {
    connection: incoming,
  });
  await api.declineQuickConnection('chat-id');
  assert.equal(calls[0].url, '/api/v1/chats/chat-id/connect/');
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[2].url, '/api/v1/chats/chat-id/connect/');
  assert.equal(calls[2].method, 'DELETE');
  assert.equal(calls[2].headers.get('X-CSRFToken'), 't');
});

test('message recovery uses a cursor and does not replay failed writes', async () => {
  const { api, calls } = harness([
    json({ messages: [], has_more: false }),
    json({ csrf_token: 't' }),
    json({ detail: 'Conversation ended.' }, 400),
  ]);
  await api.messages('chat-id', 17);
  assert.equal(calls[0].url, '/api/v1/chats/chat-id/messages/?after=17');
  await assert.rejects(api.sendMessage('chat-id', 'same-id', 'Hello'), {
    status: 400,
  });
  assert.equal(calls.length, 3);
});

test('all writes use fresh CSRF, including token rotation after verification', async () => {
  const { api, calls } = harness([
    json({ csrf_token: 'before-login' }),
    json({ id: 'user', csrf_token: 'rotated' }),
    json({ csrf_token: 'after-login' }),
    json({ profile: { alias: 'SavedAlias' } }),
  ]);
  await api.verifyCode('challenge', '123456');
  await api.createProfile({ interests: ['music', 'books', 'art'] });
  assert.equal(calls[1].headers.get('X-CSRFToken'), 'before-login');
  assert.equal(calls[3].headers.get('X-CSRFToken'), 'after-login');
  assert.equal(calls[1].url, '/api/v1/auth/verify-code/');
  assert.equal(calls[3].method, 'POST');
  for (const call of calls) {
    assert.equal(call.credentials, 'same-origin');
    assert.equal(call.cache, 'no-store');
    assert.ok(call.signal instanceof AbortSignal);
    assert.equal(call.headers.get('Authorization'), null);
  }
});

test('GET does not request CSRF or send unnecessary credentials in headers', async () => {
  const { api, calls } = harness([json({ id: 'owner' })]);
  assert.deepEqual(await api.me(), { id: 'owner' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers.get('X-CSRFToken'), null);
});

test('catalog tolerates an older response without avatar groups', async () => {
  const { api } = harness([json({ avatars: ['human-01'] })]);
  assert.deepEqual(await api.catalog(), {
    avatars: ['human-01'],
    avatar_groups: {},
  });
});

test('verification failure is shown and not automatically replayed', async () => {
  const { api, calls } = harness([
    json({ csrf_token: 'token' }),
    json({ detail: 'Invalid or expired code.' }, 400),
  ]);
  await assert.rejects(api.verifyCode('challenge', '000000'), {
    status: 400,
    message: 'Invalid or expired code.',
  });
  assert.equal(calls.length, 2);
});

test('rate limits and nested validation errors remain useful to the form', async () => {
  const { api } = harness([
    json({ csrf_token: 'token' }),
    json({ detail: 'Try again later.' }, 429),
  ]);
  await assert.rejects(api.requestCode('test@example.com'), {
    status: 429,
    message: 'Try again later.',
  });
  assert.equal(
    new ApiError(400, { preferences: { min_age: ['Must be 18 or above.'] } })
      .message,
    'min age: Must be 18 or above.',
  );
});

test('logout accepts 204 and sends a CSRF-protected POST', async () => {
  const { api, calls } = harness([
    json({ csrf_token: 'token' }),
    new Response(null, { status: 204 }),
  ]);
  assert.equal(await api.logout(), undefined);
  assert.equal(calls[1].method, 'POST');
});

test('unavailable proxy response never leaks HTML/debug pages into the UI', async () => {
  const { api } = harness([
    new Response('<html>private debug page</html>', { status: 502 }),
  ]);
  await assert.rejects(api.catalog(), {
    status: 502,
    message: 'The account service is unavailable. Please try again shortly.',
  });
});

test('network failures give a recoverable message', async () => {
  const api = createApi(async () => {
    throw new TypeError('network failure');
  });
  await assert.rejects(api.me(), {
    status: 0,
    message: 'Could not reach Halfknown. Check your connection and try again.',
  });
});
