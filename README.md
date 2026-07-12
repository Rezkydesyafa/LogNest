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

- Node.js 22 or newer
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

The full containerized Phase 10 demo services are not implemented yet. Current Compose starts PostgreSQL, MongoDB, and Redis only.

## Verification

```powershell
npm run build
npm run check:production
npm run check:dashboard
```

Focused self-checks are available as `check:phase2` through `check:phase9`.

## Production

Production Dockerfiles are available under each application directory. Apply migrations before starting the API:

```powershell
npm run prisma:migrate:deploy
```

Production hardening includes environment validation, CORS allow-listing, security headers, body limits, ingestion/auth rate limits, failed BullMQ job retention, HTTP-only dashboard sessions, and MongoDB TTL indexes.

Swagger is disabled in production unless `ENABLE_SWAGGER=true`. Terminate TLS at the platform or reverse proxy and store all credentials in the deployment secret manager.

## Current MVP

Implemented: API, worker, Docker agent, dashboard, Express middleware, frontend SDK, authentication, projects, API keys, ingestion, search, fingerprinting, incidents, AI analysis, and dashboard summaries.

Remaining for the full demo: containerize all services in one Compose file and add demo auth, payment, and order services.
