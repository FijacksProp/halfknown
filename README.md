# halfknown

An adult social discovery app for meeting people, building mutual connections, and sharing what makes each person interesting.

## Current implementation

The Django backend implements temporary guest identities, email-code account saving and sign-in, opt-in public profiles, discovery, follows, mutual connections, direct messages, showcases, blocks and reports. The earlier random chat queue remains as **Quick Meet**.

The `web/` directory uses **Vinext**, React, TypeScript, and Tailwind. It connects to Django through a local same-origin proxy and presents a light, responsive discovery experience with grouped illustrated characters. It is not yet an installable PWA.

Core social flows work locally: choose a character, opt into Discover, follow, request a connection, chat after mutual acceptance, share a showcase, and save a guest profile to email. Gender filtering, gifts, payouts, streaming, reels, voice, and video are not implemented. See the [current product specification](docs/halfknown-product-spec.md).

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

The current entry asks for a character, optional interests, adult/policy confirmations, and an explicit choice to appear in Discover. A guest can attach a new email in **My space** without losing the profile or connections.

Choose a character and optional interests, confirm 18+ status, accept the notices, and decide whether your profile appears in Discover. No email is required to begin. Add a new email in **My space** to retain the guest identity across devices. Returning accounts can request a local code from `backend/.local-mail/`. Adult confirmation is self-attestation, not independent age assurance.

The dev proxy forwards `/api/` and `/ws/` to Django without rewriting WebSocket Origin. Local settings explicitly allow the two loopback origins on port 3000; production settings do not inherit these exceptions. An optional `web/.env` can set `DJANGO_API_TARGET` (see `.env.example`). The proxy is development-only: a production reverse proxy must route these paths to a deployed Django service.

Frontend checks, from `web/`:

```powershell
npm.cmd test
node_modules\.bin\tsc.cmd --noEmit
node_modules\.bin\oxlint.cmd app lib tests scripts vite.config.ts
npm.cmd run build
```

In a sandbox that blocks child processes, the test suite also runs with `node --test --test-isolation=none tests/*.test.mjs`. The full `npm.cmd run lint` currently reports pre-existing issues in bundled `components/ui/` and `hooks/use-mobile.ts`; the changed application code is checked separately.

For an opt-in full-flow smoke check with both servers running, run `node scripts/smoke-chat.mjs` from `web/`. It creates three synthetic guest identities and a labeled test report, then checks the real frontend proxy, WebSockets, random matching, messaging, Next/requeue, stale actions, reporting, and blocking. It is not a browser interaction or visual test.

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
  apps/profiles/          Adult confirmation and anonymous identities
  apps/matching/          Random queue and durable text chat
  apps/moderation/        Blocking and report evidence
  apps/realtime/          Authenticated account event stream
  tests/                  API, privacy, eligibility, WebSocket tests
web/                      Halfknown landing and connected onboarding
docs/                     Product specification and API contract
compose.yaml              Local full-stack services
```

## Next build milestones

1. Choose/configure production Django hosting and same-origin routing; complete real launch policies, retention, age-assurance, device/IP abuse controls, and moderation operations.
2. Benchmark the database-backed matching gate with PostgreSQL/Redis and replace it before traffic exceeds the MVP design.
3. Add a safe guest-to-email account upgrade and subscription entitlement system.
4. Introduce premium gender/region filters only after queue liquidity supports them; never claim unverified gender.
5. Make the web app installable, then evaluate voice. Video remains a later safety and infrastructure project.

See [the API contract](docs/backend-api.md) and [product specification](docs/anonymous-chat-product-spec.md).
