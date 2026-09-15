# Halfknown live chat — development milestone

This implements a local, text-only match-to-chat flow. It is not a public-launch readiness claim.

## Flow

1. Sign in with a verified email and complete an adult profile.
2. Pick an intention from your profile, then Open Chat or Compatible Match.
3. The server reserves two mutually eligible users. Each must accept within 45 seconds.
4. Once both accept, send text messages. Leaving, blocking, reporting, signing out, or editing preferences ends the introduction for both people.
5. A 10-second frontend heartbeat renews a 90-second server lease. Closing the page or losing both HTTP and WebSocket connectivity expires the lease. A short WebSocket interruption alone does not end the chat; HTTP resync remains available.

Open Chat requires both explicit opt-ins and ignores gender filters only. Both modes enforce verified/active accounts, adult ages, mutual age ranges, shared language, the selected intention, and bidirectional blocks. Compatible Match also enforces mutual gender preferences, then ranks candidates by shared interests. Selection is random among equally ranked candidates in a bounded 200-person FIFO band. There is no demographic paywall, fabricated user, estimated wait promise, or automatic relaxation of preferences. Ended introductions impose a three-second requeue delay.

## API

All paths below start with `/api/v1`. Existing session authentication and CSRF rules apply. No identity or conversation authority comes from client-supplied user IDs.

| Method | Path | Body / result |
| --- | --- | --- |
| POST | `/matching/queue/` | `{mode: "open" or "compatible", intention}` → current match state; repeated joins resume the existing slot |
| DELETE | `/matching/queue/` | Cancel a queue entry or end the current introduction |
| POST | `/matching/heartbeat/` | Renew lease, clean stale reservations, and return current state |
| POST | `/chats/<uuid>/accept/` | Idempotent acceptance; both people must accept |
| GET | `/chats/<uuid>/messages/?after=<integer>` | Up to 100 messages, `has_more`, current conversation; participants only |
| POST | `/chats/<uuid>/messages/` | `{client_id: UUID, body}`; maximum 2,000 characters, no blank messages |
| POST | `/chats/<uuid>/typing/` | Notify the other participant; 30/minute throttle |
| POST | `/chats/<uuid>/block/` | End and bidirectionally disqualify future matching |
| POST | `/chats/<uuid>/report/` | `{reason, details?}`; preserve evidence, end, and block |

Match state is `idle`, `waiting`, `invited`, `active`, or `ended`. Heartbeat returns `idle` once a slot is released; the frontend retrieves the last known conversation to show its ended state. Peer data contains only alias, avatar identifier, and shared interests. Email, date of birth, preferences, and internal user IDs are not exposed to the peer. Ended messages remain accessible only to the two participants who know the conversation identifier; there is no public history endpoint.

`/ws/events/` remains an authenticated, origin-validated private event stream. Clients can only send `ping`, not create matches or messages. New events are `match.changed`, `chat.changed` (conversation ID), and `chat.typing` (conversation ID). Durable writes go through CSRF-protected HTTP, and events trigger authorized REST reads. This avoids leaking message bodies through stale sockets. Lost events recover through cursor-based reads and periodic synchronization. "Saved" means the server persisted a message; it is not a read receipt or proof the peer saw it.

## Concurrency and limits

- One database slot per user. Queue reservation, acceptance, message insertion, blocking, and profile/preference mutation use the same database-backed serialization gate.
- The gate uses a transaction and an UPDATE, not a process-local lock, and works across ASGI workers. This is intentionally a **low-volume MVP design**, not a high-scale matching architecture. Profile writes acquire the gate before user row locks to preserve lock order.
- `(sender, client_id)` is unique. Retrying identical content returns the original saved message; conflicting reuse is rejected. The UI retains the identifier after an uncertain send failure.
- Messages are throttled under the database lock to 10 per 10 seconds per sender. Existing account/API request throttles also apply.
- Frontend renders plain text, never message HTML. Message history is cursor-paginated; the viewport keeps the latest 500 messages.
- WebSocket delivery is best-effort; PostgreSQL remains authoritative. Production uses Redis channel layers. Single-process local mode uses SQLite and in-memory channels.
- Expiration is enforced on matching activity. Run `python manage.py expire_matches` every minute in deployment for cleanup during quiet periods. It releases leases, not chat history.

## Reports and privacy

Submitting a report explicitly includes the latest 20 messages, the reason, and optional details, then blocks the peer. Report retries are idempotent per reporter/conversation. Django admin exposes a report queue with new/reviewing/resolved states and review notes; resolving requires a rationale, and normal admin change logging records staff changes. Reports and evidence cannot be added or deleted through this admin UI. Staff account suspension remains available through the existing account admin; reports do not automatically ban users.

Messages are **not end-to-end encrypted**. This is a local development database. No automatic history/evidence deletion or finalized retention promise has been introduced: the product spec leaves retention policy open. Set retention periods, implement scheduled deletion and evidence/legal-hold rules, publish the policies, and complete age-assurance and moderation operations before inviting the public. Do not use real sensitive conversations in this preview.

## Verification and next gates

Local `vinext dev` uses the Node runtime so Vite exclusively proxies `/ws/` to Django. The Cloudflare emulator also claims non-HMR WebSocket upgrades and conflicts with that proxy, so it is enabled only for builds/production preview. Worker build output is preserved. Set `DJANGO_API_TARGET` when Django uses a non-default port, for example `http://127.0.0.1:8001`; the browser still uses the same frontend origin.

Automated tests cover eligibility, opt-in, reservation uniqueness, two-party acceptance, timeout, message validation/throttling/idempotency, cursor recovery, outsider rejection, CSRF, disconnect, logout, preference changes, blocking, reporting, and authenticated ASGI socket events. PostgreSQL concurrency tests are included but require the integration environment; SQLite results do not establish PostgreSQL multi-worker readiness.

Manual local trial: open the frontend in two independent browser profiles (or normal + private), sign in with different test emails, select compatible preferences and the same intention, join the same mode, accept both invitations, then exchange messages. Test leaving, blocking, and reporting. Two tabs in one browser share an account, so they cannot match one another.

Remaining public-launch gates: hosted Django and single-origin routing, PostgreSQL/Redis multi-worker integration and load tests, finalized retention, independent age assurance, operational moderation/appeals, and deployment monitoring. No hosting, payment service, or public launch is provisioned by this change.
