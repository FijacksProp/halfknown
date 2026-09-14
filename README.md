# halfknown

An adult social app for anonymous first conversations, friendship, flirting, and romance.

## Current implementation

The Django backend foundation is implemented in `backend/`: email-code sign-in, session authentication, private birth-date storage, anonymous profiles, matching preferences, blocks, mutual eligibility rules, and an authenticated account WebSocket stream.

The `web/` directory is the earlier **Unveil visual prototype**, built with **Vinext**, React, TypeScript, and Tailwind. It does not yet call Django. Its form completion only changes browser memory; it does not create an account, send email, verify age, or match people. It is not yet an installable PWA. Standard Next.js remains the agreed frontend target; migration/integration is a separate build step.

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
web/                      Existing visual prototype (not integrated)
docs/                     Product specification and API contract
compose.yaml              Local full-stack services
```

## Next build milestones

1. Integrate onboarding with Django, including consent, server-validated birth date, gender preferences, and email verification. Replace frontend-only success claims.
2. Implement queue leases, availability, atomic mutual invitations, timeout/requeue, and fairness. Recheck eligibility at invitation acceptance.
3. Implement durable text messaging, membership authorization, acknowledgements, idempotency, reconnection, pagination, and rate limits. Keep expensive work outside the message path.
4. Add report evidence, moderator decisions, appeals, mutual continuation/reveal, and connection management before a public beta.
5. Redesign Halfknown's UI and produce a consistent character collection.

See [the API contract](docs/backend-api.md) and [product specification](docs/anonymous-chat-product-spec.md).
