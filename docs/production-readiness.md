# Production preparation

This branch starts production hardening; it does not deploy Halfknown or certify it for public use.

## Implemented

- Docker defaults to `config.settings.production`, never local SQLite/file-email settings. The existing development Compose file explicitly selects local settings and remains usable.
- Startup validates the secret, PostgreSQL, exact production hosts and HTTPS origin, authenticated TLS Redis endpoints, SMTP, and configured policy version/links. It rejects common development defaults without printing credentials.
- Secure cookies, HTTPS redirects, HSTS for the application domain, TLS database connections, and certificate-validated Celery Redis TLS are enabled. HSTS preload/subdomain enforcement is deliberately not assumed.
- A Celery Beat schedule expires matching leases every 15 seconds and clears expired sessions daily. Run exactly one scheduler. Neither task deletes message history or report evidence.
- `/health/` is liveness; `/health/ready/` checks database/cache connectivity, returns 503 on failure, and reveals no infrastructure details. Restrict readiness access at the proxy; it is not a comprehensive SMTP/worker/channel-layer health check.
- Incoming WebSocket frames are limited to 20 per 10 seconds per connection in addition to the existing size, origin, and session checks. Edge connection/IP limits are still required.
- Customer-facing screens no longer contain development banners or obsolete feature promises. Real policy links are supplied by the backend catalog. Local email capture remains a local-only tool, not a production delivery mechanism.
- Guest-first random chat uses a session-owned server identity and does not expose its internal placeholder email. Production still needs guest retention and device/IP abuse controls before public access.
- Discover now requires an uploaded real photo, manual admin approval, and owner opt-in. Pending photos are available only to the owner and staff through an authenticated endpoint. Human illustration avatars have been retired; Quick Meet keeps creature portraits.

## Required configuration and processes

Use `deploy/production.env.example` as a key checklist. Put real values in the host's secret manager, not Git. Do not copy local `.env`, SQLite databases, local mail, synthetic test accounts, or the local superuser into production. Create a separate admin with a new strong password and restrict admin access.

Set `PUBLIC_ORIGIN` to the actual HTTPS frontend origin without a trailing slash. Both CSRF and WebSocket allowed origins must contain that exact value. Set explicit hostnames in `DJANGO_ALLOWED_HOSTS`. Redis services must support authenticated TLS; PostgreSQL must support TLS. Real certificate/SMTP delivery checks remain mandatory in staging.

Run, with the production environment injected:

```sh
python manage.py check --deploy --settings=config.settings.production
python manage.py migrate --noinput
python manage.py collectstatic --noinput
daphne -b 0.0.0.0 -p 8000 config.asgi:application
celery -A config worker --loglevel=WARNING --concurrency=2
celery -A config beat --loglevel=WARNING --schedule=/var/lib/halfknown/celerybeat-schedule
```

The API, worker, and scheduler are separate supervised processes. Provide a writable private persistent scheduler directory. Do not run migrations independently in every replica. Back up PostgreSQL before migrations and test restoration.

The public reverse proxy must terminate TLS and route `/api/`, `/ws/`, and `/admin/` to Django under the same browser origin as the frontend. Forward WebSocket upgrades, preserve the browser Origin and cookies, disable API caching, and serve collected Django admin static files. The Vite development proxy is **not** production routing. Only set `TRUST_PROXY_SSL_HEADER=True` when the trusted proxy overwrites that header and direct backend access is blocked.

The frontend still builds a Worker artifact. A hosting provider and production origin router are not selected/configured yet. Never deploy the frontend alone and assume it can reach the local Django backend.

Profile photos are stored under `MEDIA_ROOT` locally and are intentionally not served as public static media. Before any hosted test with real users, configure durable **private** object storage shared by all Django instances, backups and deletion lifecycle, upload-rate limits, and a staffed photo-review process. Render's ephemeral filesystem is not suitable for these uploads. Keep `/api/v1/social/profiles/<id>/photo/` behind Django authentication and authorization; do not expose the storage bucket publicly.

## Release gates still open

1. Choose domain, frontend/backend hosting, and email provider; configure DNS/TLS, verified sender, real mail delivery and retry monitoring.
2. Run PostgreSQL/Redis multi-worker tests and load tests. The current shared database matching gate intentionally serializes operations and must be benchmarked/reworked before high traffic.
3. Publish reviewed terms, privacy and community policies; decide retention and implement deletion/evidence-hold processes. URL validation does not establish legal adequacy or actual publication.
4. Complete age-assurance requirements, moderation staffing, escalation/appeals, support and account-deletion procedures.
   The current 18+ checkbox is self-attestation, not independent age verification.
5. Add infrastructure readiness checks, private error monitoring with sensitive-data scrubbing, backup/restore checks, connection/IP limits and admin access controls.
6. Perform browser/device/accessibility testing and a staging acceptance test before public signups.

Configuration reference: [Django deployment checklist](https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/) and [Channels channel layers](https://channels.readthedocs.io/en/stable/topics/channel_layers.html). Those sources inform deployment practices, not proof that this installation has been deployed or load-tested.
