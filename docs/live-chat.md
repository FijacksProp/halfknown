# Halfknown random live chat

This is the current text-only random-chat implementation. It is not a public-launch readiness claim.

## Live flow

1. A guest confirms they are 18+, chooses a privately stored gender, accepts the notices, and receives a temporary alias. A verified-email user may also return through email-code sign-in.
2. `POST /api/v1/matching/queue/` joins the single random queue. The request has no matching criteria.
3. When another eligible adult is waiting, the server reserves both users and opens an active conversation immediately.
4. **Next** ends the current conversation and requeues both recently present users, trying the initiator first. **Leave** stops the initiating user and requeues the present peer.
5. A 10-second frontend heartbeat renews a 90-second lease. If one session expires, a still-present peer is returned to the queue.

The queue ignores gender, age-range, interest, language, and intention preferences. It still enforces active verified/session identities, adult confirmation, bidirectional blocks, exclusive reservations, presence, and a ten-minute recent-pair cooldown.

## API

All paths start with `/api/v1`. Writes use session authentication and CSRF protection.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/random-access/` | Create or prepare a temporary adult identity from gender and explicit consents |
| POST | `/matching/queue/` | Join/resume the single random queue |
| DELETE | `/matching/queue/` | Stop searching or leave the active chat |
| POST | `/matching/heartbeat/` | Renew presence, clean stale reservations, and return current state |
| POST | `/chats/<uuid>/next/` | End the current chat and shuffle again |
| GET | `/chats/<uuid>/messages/?after=<integer>` | Read up to 100 authorized messages after a cursor |
| POST | `/chats/<uuid>/messages/` | Save a plain-text message with an idempotency UUID |
| POST | `/chats/<uuid>/typing/` | Send a transient typing invalidation |
| POST | `/chats/<uuid>/block/` | Block the peer and end the chat |
| POST | `/chats/<uuid>/report/` | Preserve report evidence, block, and end the chat |

Match state used by the current client is `idle`, `waiting`, or `active`; `ended` remains representable for authorized historical responses. Peer output contains only alias, avatar identifier, and an empty legacy shared-interest array. Private gender, email, adult data, preferences, and internal IDs are not exposed to a peer.

## Reliability and limits

- One database slot exists per user. A database-backed gate serializes matching, queue mutation, messages, and blocks across workers. It favors MVP correctness over high-volume throughput.
- Candidate selection is random within a bounded 200-person FIFO band, after block and recent-pair exclusions.
- `(sender, client_id)` is unique, so an identical retry returns the original message and conflicting reuse is rejected.
- Messages are limited to 2,000 characters and ten sends per ten seconds per sender.
- WebSocket messages are invalidations only. PostgreSQL-backed HTTP reads remain authoritative and recover missed events with cursors and polling.
- Reports include the latest 20 messages and are idempotent for each reporter/conversation.

The compatibility and invitation endpoints/models remain temporarily readable for migration safety, but the customer-facing client does not offer those flows. They should be removed in a later schema cleanup after production data migration is planned.

## Known production gaps

Guest identities can currently be recreated by clearing browser state, so production still needs privacy-reviewed device/IP abuse controls. Guest-account retention and deletion must be designed together with message and report evidence retention. Premium entitlements, payments, gender filters, translation, voice, and video are not implemented.
