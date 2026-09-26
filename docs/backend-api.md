# Halfknown backend foundation

Status: guest-first social discovery, follows, mutual connections, direct messages, showcases, account saving, block/report, and Quick Meet random chat are implemented locally. See the [current product specification](halfknown-product-spec.md) and [Live chat](live-chat.md). Hosted integration is pending a deployed Django endpoint.

## Architecture decision

Django 5.2 LTS and Django REST Framework own the application data and API. Django Channels provides ASGI WebSockets; PostgreSQL is the production source of truth; Redis provides cross-worker events and temporary coordination; Celery handles email and future background work. The current frontend is a Vinext prototype. The agreed standard Next.js frontend will consume Django's API rather than duplicate identity or matching rules.

Python 3.13 is the intended container baseline; Python 3.14 is installed locally and supported by the selected Django patch. Dependency versions are captured in `backend/requirements.txt`; permitted update ranges are in `requirements.in`.

Production Django needs a Python/ASGI host. The existing Cloudflare/Sites preview hosts the prototype, not Django. No backend hosting provider or paid service has been provisioned.

## Session and CSRF contract

Prefer a single browser origin in the final deployment: route `/api/`, `/ws/`, and `/admin/` to Django and other paths to the frontend. This avoids broad CORS exceptions and cross-site cookies. The local Vite proxy now forwards `/api/` and `/ws/` on port 3000 to Django on port 8000. Admin remains directly accessible on port 8000. Production routing is not yet configured.

1. GET `/api/v1/auth/csrf/` with cookies enabled.
2. Keep the returned `csrf_token` in memory. Send it as `X-CSRFToken` on every POST/PUT/PATCH/DELETE, including requests made before login.
3. POST email to `/api/v1/auth/request-code/`.
4. POST `challenge_id` and six-digit `code` to `/api/v1/auth/verify-code/`.
5. Django rotates the session and CSRF token. Use the **new** returned CSRF token for later writes.
6. Send cookies with API requests. Do not put session credentials into localStorage or WebSocket URLs.
7. POST `/api/v1/auth/logout/` to invalidate the session.

The session cookie is HTTP-only and SameSite=Lax. Production additionally requires HTTPS and Secure cookies.

API responses include private/no-store cache controls, including authentication errors. Do not override these at the frontend proxy or CDN.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health/` | Process liveness only; does not promise DB/Redis readiness |
| GET | `/api/v1/auth/csrf/` | Bootstrap CSRF |
| POST | `/api/v1/auth/request-code/` | Request a short-lived email code |
| POST | `/api/v1/auth/verify-code/` | Consume code and establish session |
| POST | `/api/v1/auth/logout/` | End current session |
| GET | `/api/v1/me/` | Private owner account and onboarding status |
| GET | `/api/v1/catalog/` | Allowed profile/preference values and policy version |
| GET | `/api/v1/identity-preview/` | Generate an unreserved alias/avatar suggestion |
| POST | `/api/v1/random-access/` | Create/prepare a session-owned guest identity with a chosen unique username after adult and policy confirmation |
| GET | `/api/v1/profile/` | Read current owner's profile/preferences |
| POST | `/api/v1/profile/` | Create onboarding profile only; 409 if it already exists |
| PUT | `/api/v1/profile/` | Atomically create/update onboarding profile |
| PUT | `/api/v1/preferences/` | Replace current owner's preferences |
| POST | `/api/v1/blocks/` | Idempotently block a profile |
| GET/PATCH | `/api/v1/social/me/` | Read/edit the owner's username, social profile, and visibility |
| GET | `/api/v1/social/discover/` | Search opt-in profiles; filter by `q`, `interest`, or `group`; paginate with `offset` |
| GET | `/api/v1/social/profiles/<id>/` | Public profile and showcase, subject to visibility and blocks |
| POST / DELETE | `/api/v1/social/me/photo/` | Upload or remove the owner's real photo; upload enters manual review and hides Discover profile |
| GET | `/api/v1/social/profiles/<id>/photo/` | Authenticated photo response; pending photos visible only to owner and staff |
| POST/DELETE | `/api/v1/social/profiles/<id>/follow/` | Follow or unfollow |
| POST/DELETE | `/api/v1/social/profiles/<id>/connect/` | Request/reciprocate or remove a connection |
| GET | `/api/v1/social/connections/` | Accepted and pending connections, newest-message preview/time, and unread count |
| POST | `/api/v1/social/connections/<id>/accept/` | Accept an incoming request |
| GET/POST | `/api/v1/social/connections/<id>/messages/` | Read or send free messages after acceptance |
| POST | `/api/v1/social/showcase/` | Add a talent, project, or interest |
| DELETE | `/api/v1/social/showcase/<id>/` | Remove a showcase item |
| POST | `/api/v1/social/profiles/<id>/block/` | Block and remove the relationship |
| POST | `/api/v1/social/profiles/<id>/report/` | Preserve recent evidence, report, and block |
| POST | `/api/v1/chats/<id>/connect/` | Ask to keep in touch from an active Quick Meet chat |
| WS | `/ws/events/` | Receive private account events |

Connection requests, acceptance/removal, and direct messages send body-free `social.connection.changed` or `social.message.changed` events to the two participants. Clients then refetch the authorized inbox/message APIs; periodic polling recovers missed events. A conversation's unread count advances only when its messages are fetched, and its last-message preview is available only to participants.

Authentication, catalog, and identity-preview endpoints are public; other APIs require an active account with verified email. Birth date is self-declared and validated server-side. This is an adult eligibility gate, not independent age assurance.

## Email codes

Request body:

```json
{"email": "person@example.com"}
```

Response: HTTP 202 with a UUID `challenge_id` and a generic delivery message. The response never includes the code. Email is normalized to lowercase and constrained uniquely in the database. An anonymous request does not reveal whether an email already has an account. A signed-in guest who tries to claim an email already in use receives a validation error and must sign in to that account separately; profiles are never silently merged.

Verify body:

```json
{"challenge_id": "<returned UUID>", "code": "<six digits from email>"}
```

Codes expire after ten minutes, allow five verification attempts, and are consumed once. Resend cooldown is 60 seconds with five sends per account per hour. Resends after cooldown invalidate the previous challenge. Additional endpoint throttles limit requests by IP (or account for authenticated callers). Production uses a shared Redis cache. DRF throttles are best-effort and must be backed by edge-level abuse controls before public launch.

PostgreSQL user-row locks serialize issue/verify operations. Only an HMAC digest is stored in the application database. Task arguments are redacted from Celery's displayed representation; the broker still carries the code for delivery and must be private and encrypted in a hosted deployment. Delivery errors currently fail the request; robust provider retries/outbox processing are a future hardening step.

Default Windows development writes email to `.local-mail/`. Docker uses Mailpit. Neither setup sends mail to real people.

## Onboarding payload

The selected values must come from `/api/v1/catalog/`. An example PUT body:

```json
{
  "birth_date": "2000-01-01",
  "accepted_terms": true,
  "accepted_guidelines": true,
  "policy_version": "development-draft-1",
  "avatar_id": "alien-01",
  "gender": "man",
  "intentions": ["dating", "friendship"],
  "interests": ["music", "books", "art"],
  "languages": ["en"],
  "conversation_style": "playful",
  "prompt_answer": "Music for rainy days.",
  "preferences": {
    "genders": ["woman", "nonbinary"],
    "min_age": 18,
    "max_age": 40,
    "open_chat_opt_in": false
  }
}
```

Onboarding asks for a username and assigns a random nonhuman creature group and portrait. Creature portraits are fictional identities, not member photos or identity verification. Discover requires a separate real photo: an upload is processed into metadata-stripped WebP, reviewed by an admin, then the owner can opt in to public Discover. Quick Meet and signup do not require a real photo.

PrivateProfile stores birth date and consent separately. Profile responses omit email, birth date, authentication information, and the internal account relation. The owner serializer remains private. The social discovery serializer has a separate public allowlist and exposes only profiles whose owners opted in; older anonymous accounts are hidden by migration.

Birth-date changes after initial completion are rejected pending a future support correction process. Terms and guidelines are development consent placeholders, not finalized legal documents. Policy acceptance history/version upgrades require implementation before release.

## Eligibility rules

`apps.matching.eligibility.eligible(left, right, mode=..., intention=...)` applies:

- Different, active, verified accounts with complete profiles
- No block in either direction
- Both adults and inside each other's age bounds
- Shared selected intention and at least one shared language
- Compatible mode: mutual gender preferences
- Open mode: both expressly opted in to any-gender chat

This rules service now feeds the matching queue described in [Live chat](live-chat.md). The queue fetches current records, reserves one introduction per user, and rechecks eligibility before acceptance and new messages. Location filtering remains absent pending a location preference/storage policy; production-scale fairness and capacity testing are still pending.

## Blocking

POST `/api/v1/blocks/` with `{"profile_id":"<UUID>"}`. Returns 204 even if the block already exists. Self-blocking is rejected. Blocking ends any active introduction between the pair and disqualifies future matching in both directions. New messages are rejected; participants retain access to their existing conversation evidence. Chat-scoped block/report endpoints avoid exposing peer account IDs.

## WebSocket contract

Connect to `/ws/events/` with the session cookie and an explicitly allowed Origin. Anonymous, unverified, disabled, expired-session, and untrusted-origin connections are rejected.

Server opens with `{"type":"connection.ready"}`. Clients can send only `{"type":"ping"}` and receive `{"type":"pong"}`. Other messages receive an error; clients cannot forge match events. Binary or greater-than-1KB frames close with code 4400. Missing/revoked authentication closes with code 4401.

Server services can publish to the authenticated account's internal group:

```python
await channel_layer.group_send(f"account.{user.pk.hex}", {
    "type": "account.event",
    "payload": {"type": "example.event"},
})
```

Session validity is rechecked on incoming/outgoing events and every 30 seconds while idle. Matching and chat publish invalidation and typing events through this stream; authorized HTTP requests own durable writes and history recovery. Per-connection ping throttles and load testing remain before public traffic.

## Validation and limits

Functional tests exercise OTP replay/expiry/lockout, CSRF rotation, account restrictions, privacy boundaries, birthday validation, mutual eligibility, blocks, socket Origin checks, event authorization, and session revocation. A separate PostgreSQL-only test verifies concurrent single-use OTP consumption.

Frontend unit tests cover the cookie/CSRF API contract, token refresh, validation errors, code failure, unavailable services, birth-date boundaries, preferences, and unchecked consent defaults. The local HTTP smoke check exercises the same API client through the frontend proxy. Reload/session recovery is implemented; browser interaction and visual QA have not been performed.

POST onboarding creation locks the user row before checking for an existing profile, so another tab cannot overwrite a completed profile through this path. A 409 causes the frontend to retrieve the saved profile instead. PUT remains the explicit full-update endpoint; preferences have their own PUT endpoint. The old preview tool that could mark onboarding complete in memory was removed; completion now depends on a server response.

Local SQLite tests cannot establish PostgreSQL locking or Redis cross-process delivery. Docker, PostgreSQL/Redis integration, real worker delivery, production hosting, and load testing remain unverified until those environments run. Do not claim a concurrency capacity or latency target from functional tests.

## Sources

- [Django 5.2 compatibility and LTS](https://docs.djangoproject.com/en/5.2/releases/5.2/)
- [Channels authentication](https://channels.readthedocs.io/en/stable/topics/authentication.html)
- [Channels production channel layers](https://channels.readthedocs.io/en/stable/topics/channel_layers.html)
- [Celery introduction](https://docs.celeryq.dev/en/stable/getting-started/introduction.html)
- [Vite development proxy and WebSocket Origin guidance](https://vite.dev/config/server-options#server-proxy)
