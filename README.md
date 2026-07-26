# LogMind AI

LogMind AI is a centralized logging and incident platform for Docker-based applications. It collects container, API, worker, manual, and browser logs; stores raw events in MongoDB; processes errors through BullMQ; and stores incidents in PostgreSQL.

## Architecture

```text
Docker containers ──> Docker Agent ──┐
Express services ──> API middleware ─┼─> NestJS API ─> MongoDB raw_logs
Browser apps ──────> Frontend SDK ───┘                    │
                                                          v
                                                    Redis / BullMQ
                                                          │
                                                          v
                                                   NestJS Worker
                                                   fingerprinting
                                                   incident detection
                                                          │
                                                          v
                                                     PostgreSQL
                                                          │
                                                          v
                                               Dashboard API + Next.js UI
```

PostgreSQL stores users, projects, API keys, services, incidents, and incident events. MongoDB stores raw logs, parsed logs, and AI analysis results. Redis provides the processing queue and fingerprint frequency windows.

## Repository

```text
apps/
  api/                 NestJS REST API
  worker/              BullMQ log processor
  agent/               Docker socket log collector
  dashboard/           Next.js operations dashboard
  demo-services/       Express demo services that generate traffic for the demo
packages/
  shared/              Database, queue, redaction, alerting, AI, and event contracts
  api-logger-express/  Express request/response middleware
  frontend-logger/     Browser error and failed-fetch SDK
prisma/                PostgreSQL schema and migrations
```

Unit tests live next to the code they cover as `*.spec.ts`.

## Requirements

- Node.js 22 LTS (`.nvmrc` is included)
- npm 10 or newer
- Docker with Docker Compose

## Local Setup

1. Install dependencies and create the environment file.

   ```powershell
   npm install
   Copy-Item .env.example .env
   ```

2. Start PostgreSQL, MongoDB, and Redis.

   ```powershell
   npm run docker:up
   ```

3. Apply the database schema.

   ```powershell
   npm run prisma:migrate
   npm run prisma:generate
   ```

4. Start each process in a separate terminal.

   ```powershell
   npm run dev:api
   npm run dev:worker
   npm run dev:dashboard
   ```

   The Docker agent is optional during local development:

   ```powershell
   npm run dev:agent
   ```

## Access

- Dashboard: `http://localhost:3001`
- API: `http://localhost:3000`
- Health: `http://localhost:3000/health`
- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/docs-json`

Register through the dashboard or `POST /auth/register`, create a project, then create server and client API keys from the API Keys page. Raw keys are only returned once.

## Sessions

`POST /auth/login` and `POST /auth/register` return a short-lived access token
(`JWT_EXPIRES_IN_SECONDS`, default 15 minutes) together with a refresh token
(`REFRESH_TOKEN_TTL_DAYS`, default 30 days).

- `POST /auth/refresh` exchanges the refresh token for a new pair. The refresh token is
  rotated on every use; replaying a spent one revokes the whole family, which is how a
  stolen token is detected.
- `POST /auth/logout` revokes the refresh token and denies the still-valid access token by
  its `jti` in Redis, so logout takes effect immediately rather than at expiry.
- `POST /auth/logout-all` ends every session for the user.
- `POST /auth/forgot-password` and `POST /auth/reset-password` handle a forgotten password.
  The request endpoint answers identically whether or not the email exists, so it cannot be
  used to discover accounts. A reset ends every existing session.

No mail provider is wired up yet: the reset link is written to the API log at warn level.
Replace `PasswordResetService.deliver` with an SMTP or provider call to send it for real.

Refresh tokens are stored as SHA-256 hashes, never in plain text. The dashboard keeps both
tokens in HTTP-only cookies and transparently refreshes on a 401, so a short access token
lifetime does not interrupt the user.

## Environment

The complete list is documented in `.env.example`. Production requires valid values for:

```env
DATABASE_URL=
MONGODB_URL=
REDIS_URL=
JWT_SECRET=
CORS_ORIGIN=
LOGMIND_API_URL=
```

AI analysis uses deterministic local output by default. Enable OpenAI with:

```env
AI_PROVIDER_MODE=openai
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

Browser logging from the dashboard is optional:

```env
NEXT_PUBLIC_LOGMIND_API_URL=http://localhost:3000
NEXT_PUBLIC_LOGMIND_CLIENT_KEY=
```

Keep `TRUST_PROXY_HOPS=0` when the API is exposed directly. Set it to the exact number of trusted reverse proxies only when direct access to the API is blocked.

## Log Ingestion

Server API keys can send `docker`, `api`, `worker`, and `manual` logs:

```http
POST /logs/ingest
x-api-key: lm_server_...
content-type: application/json

{
  "sourceType": "api",
  "serviceName": "payment-service",
  "environment": "development",
  "level": "error",
  "message": "Database connection timeout",
  "timestamp": "2026-07-08T10:30:00.000Z"
}
```

Batches go to `POST /logs/ingest/bulk` with `{ "logs": [...] }`, up to 500 entries per
request. A batch costs one ingest-rate-limit unit per log it carries, so batching improves
throughput without widening the per-minute budget.

Client API keys can only send browser logs to `POST /logs/frontend`.

### Redaction

Every ingested payload is redacted before it is stored:

- Keys such as `password`, `token`, `authorization`, `cookie`, `secret`, `apiKey`,
  `credential`, and `session` are replaced wholesale, at any depth.
- The free-text `message` and `stackTrace` are scanned for secrets that key-based masking
  cannot reach: JWTs, `Bearer`/`Basic` credentials, LogMind/OpenAI/GitHub/AWS/Slack keys,
  passwords inside connection strings, `key=value` secret assignments, email addresses,
  private key blocks, and card numbers that pass a Luhn check.

## Team Access

A project is shared through members rather than a single owner. Roles, from lowest to
highest: `VIEWER` (read logs, incidents, dashboards), `MEMBER` (also change incident status
and run AI analysis), `ADMIN` (also manage API keys, alert channels, rules, and members),
`OWNER` (also delete the project). The creator becomes the owner, and a project always
keeps at least one.

```http
POST /projects/:projectId/members   { "email": "teammate@example.com", "role": "MEMBER" }
GET  /projects/:projectId/members
PATCH  /projects/members/:memberId  { "role": "ADMIN" }
DELETE /projects/members/:memberId
```

## Alerting

Incidents notify a channel when they open, escalate in severity, or reopen. Channels are
Slack, Discord, Telegram, or a generic webhook; channel secrets are write-only and are
never returned by the API.

```http
POST /projects/:projectId/alert-channels  { "name": "ops-slack", "type": "SLACK", "config": { "webhookUrl": "..." } }
POST /alert-channels/:channelId/test
POST /projects/:projectId/alert-rules     { "name": "critical-prod", "channelId": "...", "minSeverity": "HIGH", "environments": ["production"], "throttleMinutes": 30 }
GET  /projects/:projectId/alert-deliveries
```

A rule matches on minimum severity, service, and environment, and throttles per incident so
a loud incident alerts once per window instead of once per error log. Every attempt is
recorded as `SENT`, `FAILED`, or `THROTTLED`. Set `DASHBOARD_URL` to include a deep link in
each message.

## Audit Log

Every mutation records who did it: project and member changes, API key creation and
revocation, alert channel and rule changes, incident status changes, and AI analysis
requests. Entries keep the actor email, IP, and user agent, and are readable by project
admins at `GET /projects/:projectId/audit-logs` or under **Settings → Audit log**.

The trail is append-only and the application never updates or deletes an entry. `userId` is
set to null if the account is deleted, while `actorEmail` is kept, so history survives.

## Retention

MongoDB expires raw and parsed logs through a TTL index. Postgres has no equivalent, so the
worker sweeps hourly (`RETENTION_INTERVAL_MS`), removing expired refresh and password reset
tokens plus rows past their window: `AUDIT_LOG_RETENTION_DAYS` (365),
`ALERT_DELIVERY_RETENTION_DAYS` (90), `INCIDENT_EVENT_RETENTION_DAYS` (180). The sweep is
claimed in Redis so several worker replicas do not run it at once.

## Metrics

Both processes expose Prometheus metrics: the API at `GET /metrics`, the worker on its own
port (`WORKER_METRICS_PORT`, default 3002). Set `METRICS_TOKEN` to require
`Authorization: Bearer <token>` on both. The worker also answers `/health` there,
unauthenticated, for orchestrator probes.

In production both ports stay inside the Compose network and Caddy returns 404 for
`/backend/metrics`, so a scraper must run alongside the stack rather than over the internet.

Beyond the Node.js defaults, the exported series are `logmind_http_requests_total`,
`logmind_http_request_duration_seconds`, `logmind_logs_ingested_total`,
`logmind_logs_queued_total`, `logmind_jobs_processed_total`, `logmind_job_duration_seconds`,
`logmind_incidents_total`, `logmind_alerts_total`, `logmind_ai_analyses_total`, and
`logmind_queue_depth`. Every series carries a `logmind_process` label so API and worker are
distinguishable. HTTP metrics are labelled by route *template*, not by URL, to keep
cardinality bounded.

## Live Updates

`GET /events/stream?projectId=` is a Server-Sent Events feed of incident activity. The
worker publishes through Redis pub/sub and every API replica fans out to the browsers it
holds open, so the dashboard stays live behind more than one instance. The Incidents page
subscribes to it and shows a live indicator.

## Express Middleware

```ts
import { logmindApiLogger } from '@logmind/api-logger-express';

app.use(logmindApiLogger({
  apiKey: process.env.LOGMIND_API_KEY,
  serviceName: 'auth-service',
  environment: 'development',
  endpoint: 'http://localhost:3000/logs/ingest',
}));
```

The middleware records method, path, status, duration, request ID, IP, user agent, and errors. Delivery failures never crash the host application.

## Frontend SDK

```ts
import { initLogMindFrontend } from '@logmind/frontend-logger';

initLogMindFrontend({
  apiKey: process.env.NEXT_PUBLIC_LOGMIND_CLIENT_KEY,
  serviceName: 'frontend-dashboard',
  environment: 'development',
  endpoint: 'http://localhost:3000/logs/frontend',
});
```

The SDK captures global errors, unhandled rejections, and failed fetch requests. Delivery failures are ignored by design.

## Docker Agent

The agent watches containers with `logmind.enabled=true` and ignores itself.

```yaml
labels:
  logmind.enabled: "true"
  logmind.service: "payment-service"
  logmind.environment: "development"
```

Mount `/var/run/docker.sock` when running the agent as a container.

To discover Compose services without adding labels, configure allowlists on the agent:

```env
LOGMIND_COMPOSE_PROJECTS=docker
LOGMIND_COMPOSE_SERVICES=backend,celery_worker
LOGMIND_DEFAULT_ENVIRONMENT=production
```

Explicit `logmind.enabled=false` always opts a container out. Python tracebacks are grouped into one log with the full stack trace.

The agent buffers lines and delivers them in batches (`LOGMIND_AGENT_BATCH_SIZE`, default
100, flushed at least every `LOGMIND_AGENT_BATCH_INTERVAL_MS`). The buffer is capped at
`LOGMIND_AGENT_MAX_QUEUE`; beyond that the oldest lines are dropped and the drop is logged,
so a container spamming output cannot exhaust the agent's memory or flood the API. Pending
lines are flushed on `SIGTERM`.

## Incident Processing

Error and fatal logs are queued after ingestion. The worker normalizes messages, generates fingerprints, stores parsed logs, and maintains a Redis frequency window.

Severity classification:

- `low`: 1-2 errors in 10 minutes
- `medium`: 3-4 errors in 10 minutes
- `high`: 5 or more errors in 10 minutes
- `critical`: 3 or more fatal errors in 5 minutes

An incident is only *opened* at `high` or `critical`, so the incident list stays actionable.
Each incident tracks two counters: `occurrenceCount` is the lifetime total and only ever
increments, while `recentCount` is the current 10 minute window.

The incident write is a single atomic upsert on the fingerprint key, so `WORKER_CONCURRENCY`
can be raised without workers colliding on the same fingerprint.

### AI analysis

Analysis runs on its own queue. The worker enqueues it automatically for incidents at or
above `AUTO_ANALYSIS_MIN_SEVERITY` (default `HIGH`), once per
`AUTO_ANALYSIS_COOLDOWN_MINUTES` per incident, so a noisy incident is analysed once per
window rather than once per error log. Set `AUTO_ANALYSIS_ENABLED=false` to keep analysis
manual. `POST /incidents/:incidentId/analyze` still triggers it on demand. Results are
stored in MongoDB before the incident AI fields are updated in PostgreSQL.

## Demo Flow

1. Start infrastructure, API, worker, and dashboard.
2. Register and create a project.
3. Create a server API key.
4. Send five equivalent error logs within ten minutes.
5. Watch Incidents in the dashboard update live and inspect the generated fingerprint group.
6. Generate the AI analysis from the incident detail page.
7. Optionally add an alert channel under Alerts, send a test alert, then add a rule.

## Demo Services

`apps/demo-services` is one Express app that runs as `demo-auth-service`,
`demo-payment-service`, or `demo-order-service` depending on `DEMO_SERVICE`. One codebase
serves all three because they differ only in their routes and failure modes; each still
appears as its own service in LogMind.

Each instance uses `@logmind/api-logger-express`, writes JSON to stdout for the Docker agent
to collect, and drives its own endpoints on a timer so the demo produces traffic without
anyone clicking. `DEMO_ERROR_RATE` (default 0.25) controls how much of that traffic fails,
and the failure messages are deliberately constant so repeats collapse into one incident.
Their request bodies contain fake secrets on purpose, which demonstrates redaction.

```powershell
# Infrastructure only (default)
npm run docker:up

# Infrastructure plus the three demo services
docker compose --profile demo up -d
```

Point them at a running API with `LOGMIND_API_KEY` and `LOGMIND_INGEST_ENDPOINT`. Locally
`npm run dev:demo` runs one service directly; `compose.production.yml` includes all three.

Local Compose starts infrastructure by default; `compose.production.yml` runs the LogMind
applications, the demo services, and infrastructure on a VPS.

## Verification

```powershell
npm run verify
```

```powershell
npm run test:integration
```

`verify` runs the formatter check, ESLint, TypeScript, and the Vitest unit suite.
`test:integration` is separate and needs Docker: Testcontainers starts Postgres, MongoDB,
and Redis, applies the real migrations, then exercises the API and worker together — the
full ingest → fingerprint → incident pipeline, refresh token rotation, role enforcement, and
secret encryption. CI runs both. The individual
steps are `npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm test`
(`npm run test:coverage` for coverage, `npm run test:watch` while developing).

`npm run build` compiles every app. A `pre-commit` hook formats and lints staged files.
CI runs on every pull request and on `main`; deployment runs only after it passes.

## Production

Production deployment uses `compose.production.yml`, Caddy, Cloudflare Tunnel, and `.github/workflows/deploy.yml`. PostgreSQL, MongoDB, and Redis are private to the Compose network; Caddy binds only to `127.0.0.1:${CADDY_HOST_PORT}` for the local tunnel origin.

Prepare an Ubuntu VPS with Docker Engine and the Compose plugin, then create the application directory:

```bash
sudo mkdir -p /opt/logmind/releases
sudo chown -R "$USER":"$USER" /opt/logmind
```

Copy `.env.production.example` to `/opt/logmind/.env.production` and replace every placeholder. Use URL-safe secrets, for example `openssl rand -hex 32`. Publish the application hostname through Cloudflare Tunnel to `http://localhost:18080`, then configure:

```env
SITE_ADDRESS=:80
PUBLIC_API_URL=https://logmind.example.com/backend
CADDY_HOST_PORT=18080
CORS_ORIGIN=https://logmind.example.com
```

Add these GitHub production environment secrets:

- `VPS_HOST`: VPS IP or hostname
- `VPS_USER`: SSH user with Docker access
- `VPS_SSH_KEY`: private deployment key without a passphrase
- `VPS_KNOWN_HOSTS`: the VPS SSH host public key in known-hosts format
- `CF_ACCESS_CLIENT_ID`: Cloudflare Access service token client ID
- `CF_ACCESS_CLIENT_SECRET`: Cloudflare Access service token client secret

Optional GitHub environment variables:

- `VPS_PORT`: defaults to `22`
- `VPS_APP_DIR`: defaults to `/opt/logmind`

A push to `main`, or a manual run of **CI and Deploy**, runs checks, connects through Cloudflare Access, uploads the release, applies Prisma migrations, and starts the production stack. GitHub Actions secrets are only exposed when explicitly referenced by a workflow, and deployment concurrency is limited to one run at a time.

After deployment:

- Dashboard: `https://logmind.example.com`
- API health: `https://logmind.example.com/backend/health`
- Containers: `docker compose --project-name logmind -f /opt/logmind/current/compose.production.yml ps`
- Logs: `docker compose --project-name logmind -f /opt/logmind/current/compose.production.yml logs -f api worker`

Create a server API key from the dashboard, set it as `LOGMIND_API_KEY` in `/opt/logmind/.env.production`, then rerun the deployment workflow to activate Docker log forwarding. Set the client key and rebuild only when browser logging is required.

For a manual deployment from a checked-out release, apply migrations before starting the stack:

```bash
docker compose --env-file .env.production -f compose.production.yml build
docker compose --env-file .env.production -f compose.production.yml run --rm api npx prisma migrate deploy
docker compose --env-file .env.production -f compose.production.yml up -d --wait
```

Production hardening includes environment validation, CORS allow-listing, security headers,
body limits, failed BullMQ job retention, HTTP-only dashboard sessions, MongoDB TTL indexes,
role-based project access, and payload redaction.

Alert channel configs hold webhook URLs and bot tokens, so they are encrypted at rest with
AES-256-GCM. Set `ALERT_ENCRYPTION_KEY` to 32 bytes (`openssl rand -hex 32`); production
refuses to start without it. Rows written before a key was configured stay readable, so
enabling encryption needs no data migration.

Rate limits are counted in Redis rather than per process, so the limit holds across every
API replica instead of being multiplied by their number. Auth, ingest, and read routes have
separate budgets (`AUTH_RATE_LIMIT_PER_MINUTE`, `INGEST_RATE_LIMIT_PER_MINUTE`,
`READ_RATE_LIMIT_PER_MINUTE`). Requests are metered per API key when one is present and per
IP otherwise, so tenants behind a shared address do not spend each other's budget. If Redis
is unreachable the limiter degrades to a per-process counter rather than letting traffic
through unmetered.

Swagger is disabled in production unless `ENABLE_SWAGGER=true`. Cloudflare terminates public HTTPS; Caddy serves HTTP only on the tunnel origin.

## Current MVP

Implemented: API, worker, Docker agent, dashboard, Express middleware, frontend SDK,
authentication, projects and team roles, API keys, single and bulk ingestion, search,
fingerprinting, incidents, alerting, automatic and on-demand AI analysis, live incident
streaming, and dashboard summaries.

Remaining for the full demo: add demo auth, payment, and order services.
