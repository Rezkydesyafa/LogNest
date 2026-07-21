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
packages/
  shared/              Database, queue, logging, and log storage contracts
  api-logger-express/  Express request/response middleware
  frontend-logger/     Browser error and failed-fetch SDK
prisma/                PostgreSQL schema and migrations
scripts/               Runnable self-checks
```

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

Client API keys can only send browser logs to `POST /logs/frontend`. Sensitive keys such as password, token, authorization, cookie, and secret are masked before storage.

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

The agent watches only containers with `logmind.enabled=true` and ignores itself.

```yaml
labels:
  logmind.enabled: "true"
  logmind.service: "payment-service"
  logmind.environment: "development"
```

Mount `/var/run/docker.sock` when running the agent as a container.

## Incident Processing

Error and fatal logs are queued after ingestion. The worker normalizes messages, generates fingerprints, stores parsed logs, and maintains a Redis frequency window.

- `low`: 1-2 errors in 10 minutes
- `medium`: 3-4 errors in 10 minutes
- `high`: 5 or more errors in 10 minutes
- `critical`: 3 or more fatal errors in 5 minutes

Incident analysis is requested asynchronously through `POST /incidents/:incidentId/analyze` and stored in MongoDB before incident AI fields are updated in PostgreSQL.

## Demo Flow

1. Start infrastructure, API, worker, and dashboard.
2. Register and create a project.
3. Create a server API key.
4. Send five equivalent error logs within ten minutes.
5. Open Incidents in the dashboard and inspect the generated fingerprint group.
6. Generate the AI analysis from the incident detail page.

The Phase 10 demo services are not implemented yet. Local Compose starts only infrastructure; `compose.production.yml` runs the LogMind applications and infrastructure on a VPS.

## Verification

```powershell
npm run build
npm run check:production
npm run check:dashboard
```

Focused self-checks are available as `check:phase2` through `check:phase9`.

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

Production hardening includes environment validation, CORS allow-listing, security headers, body limits, ingestion/auth rate limits, failed BullMQ job retention, HTTP-only dashboard sessions, and MongoDB TTL indexes.

Swagger is disabled in production unless `ENABLE_SWAGGER=true`. Cloudflare terminates public HTTPS; Caddy serves HTTP only on the tunnel origin.

## Current MVP

Implemented: API, worker, Docker agent, dashboard, Express middleware, frontend SDK, authentication, projects, API keys, ingestion, search, fingerprinting, incidents, AI analysis, and dashboard summaries.

Remaining for the full demo: add demo auth, payment, and order services.
