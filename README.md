# halfknown

An adult social app for anonymous first conversations, friendship, flirting, and romance.

## Current implementation

The Django backend foundation is implemented in `backend/`: email-code sign-in, session authentication, private birth-date storage, anonymous profiles, matching preferences, blocks, mutual eligibility rules, and an authenticated account WebSocket stream.

The `web/` directory uses **Vinext**, React, TypeScript, and Tailwind. Its onboarding now connects to Django through a local same-origin proxy: email-code verification, server-validated profile creation, returning sign-in, saved profile recovery, matching-preference editing, and logout. It is not yet an installable PWA. Standard Next.js remains the agreed frontend target; migrating the runtime is a separate step.

Matching and person-to-person chat are not live. Those cards are explicitly unavailable, not simulated matches. The existing hosted preview has not been updated: the new integration requires a deployed Django endpoint before it can work there.

The new Halfknown appearance and AI-generated character artwork are deferred. Django owns all real identity, eligibility, and safety decisions.

## Run the API locally on Windows

Python 3.13 or 3.14 is supported. Local validation was performed with Python 3.14; the container uses 3.13.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

No `.env` is needed for the isolated local defaults. To customize them, copy `backend/.env.example` to `backend/.env`.

- Liveness: `http://127.0.0.1:8000/health/`
- Catalog: `http://127.0.0.1:8000/api/v1/catalog/`
- Admin: `http://127.0.0.1:8000/admin/`
- Create an admin: `.\.venv\Scripts\python.exe manage.py createsuperuser`
- Development email messages are saved to ignored `backend/.local-mail/`. Nothing is sent to a real inbox in this mode. These files contain sign-in codes: keep them private.

This local mode uses SQLite, in-memory channels/cache, and synchronous Celery execution. It is for one process and functional testing, not concurrency or performance claims.

## Run the connected frontend

Keep Django running on port 8000. In a second terminal from the workspace root:

```powershell
cd web
npm.cmd ci
npm.cmd run dev
```

Open `http://127.0.0.1:3000/`. `npm.cmd` avoids PowerShell's script-policy restriction on `npm.ps1`; on macOS/Linux use `npm`. Node 22.18+ or 24+ is needed for the TypeScript-based test utilities; local verification used Node 24.

Choose intentions, enter a birth date and matching boundaries, select interests, review the development disclosures, then request a code. In local file-email mode, open the newly captured message in `backend/.local-mail/` to retrieve it. Once verified, the profile is saved in Django and reloads with the session. Unsaved drafts are held only in memory and disappear on refresh. The birthday check is self-declared adult eligibility, not independent age assurance.

The dev proxy forwards `/api/` and `/ws/` to Django without rewriting WebSocket Origin. Local settings explicitly allow the two loopback origins on port 3000; production settings do not inherit these exceptions. An optional `web/.env` can set `DJANGO_API_TARGET` (see `.env.example`). The proxy is development-only: a production reverse proxy must route these paths to a deployed Django service.

Frontend checks, from `web/`:

```powershell
npm.cmd test
node_modules\.bin\tsc.cmd --noEmit
node_modules\.bin\oxlint.cmd app lib tests scripts vite.config.ts
npm.cmd run build
```

In a sandbox that blocks child processes, the test suite also runs with `node --test --test-isolation=none tests/*.test.mjs`. The full `npm.cmd run lint` currently reports pre-existing issues in bundled `components/ui/` and `hooks/use-mobile.ts`; the changed application code is checked separately.

For an opt-in HTTP smoke check with both servers running in **local file-email mode**, run `node scripts/smoke-onboarding.mjs` from `web/`. It creates one synthetic account and checks the actual frontend proxy, CSRF, email verification, profile persistence, preferences, and logout. The test account and captured mail remain in the ignored local database/mail folder; codes are never printed. Do not run it against an SMTP-backed environment. This is not a browser interaction or visual test.

## Run PostgreSQL, Redis, and a worker

Requires Docker with Compose. From the workspace root:

```powershell
docker compose up --build
```

This starts PostgreSQL, Redis, database migrations, Django/Daphne, a Celery worker, and Mailpit. All exposed ports bind to loopback. Mailpit captures development emails at `http://localhost:8025`; it does not deliver externally.

The Compose configuration is for development, not public deployment. The data volume persists across restarts. Do not delete it to troubleshoot without backing up any data you need.

## Verification

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
```

To test against real PostgreSQL/Redis from the workspace root:

```powershell
docker compose --profile test run --build --rm integration-tests
```

The PostgreSQL-only concurrent OTP-consumption test deliberately skips in SQLite mode. Docker and real service integration have not been executed on the current Windows machine because Docker is unavailable.

## Structure

```text
backend/
  config/                 Settings, URLs, ASGI, Celery
  apps/accounts/          Custom user, hashed OTP, sessions
  apps/profiles/          Private data, anonymous profile, preferences
  apps/matching/          Mutual eligibility service
  apps/moderation/        Blocking foundation
  apps/realtime/          Authenticated account event stream
  tests/                  API, privacy, eligibility, WebSocket tests
web/                      Connected onboarding; visual redesign still pending
docs/                     Product specification and API contract
compose.yaml              Local full-stack services
```

## Next build milestones

1. Migrate the frontend runtime to standard Next.js and choose/configure production Django hosting and same-origin routing. Finish real launch policies and age-assurance decisions before public sign-ups.
2. Implement queue leases, availability, atomic mutual invitations, timeout/requeue, and fairness. Recheck eligibility at invitation acceptance.
3. Implement durable text messaging, membership authorization, acknowledgements, idempotency, reconnection, pagination, and rate limits. Keep expensive work outside the message path.
4. Add report evidence, moderator decisions, appeals, mutual continuation/reveal, and connection management before a public beta.
5. Redesign Halfknown's UI and produce a consistent character collection.

See [the API contract](docs/backend-api.md) and [product specification](docs/anonymous-chat-product-spec.md).
