# LogMind AI

Centralized logging and incident platform for Docker-based applications.

## Phase 1 Scope

This repository currently contains the backend foundation only:

- `apps/api`: NestJS HTTP API with Swagger, Pino logging, global filters, interceptors, PostgreSQL, MongoDB, Redis, and BullMQ wiring.
- `apps/worker`: NestJS worker process connected to the same databases and BullMQ queue.
- `packages/shared`: shared constants and infrastructure used by API and worker.
- `docker-compose.yml`: PostgreSQL, MongoDB, and Redis for local development.

Log ingestion, API keys, auth, incident grouping, AI analysis, SDKs, agent, and dashboard are intentionally left for later phases.

## Setup

```bash
npm install
npm run docker:up
npm run prisma:migrate
npm run prisma:generate
npm run dev:api
npm run dev:worker
```

On PowerShell, copy the env file with:

```powershell
Copy-Item .env.example .env
```

API docs are available at `http://localhost:3000/docs`.

Health check:

```bash
curl http://localhost:3000/health
```

## Architecture

PostgreSQL is accessed through Prisma and will hold relational product data in later phases.
MongoDB is accessed through Mongoose and will hold raw and parsed logs.
Redis powers BullMQ queues so ingestion requests can stay fast once `/logs/ingest` is added.

Phase 1 keeps the database schema empty except for connectivity. Tables will be added when their features are implemented.

## Trade-offs

The monorepo uses plain npm workspaces and `tsc` instead of Nx or Turborepo. That keeps Phase 1 small and avoids owning orchestration before it is useful.

## Phase 1 Demo Flow

1. Start PostgreSQL, MongoDB, and Redis with `npm run docker:up`.
2. Start the API with `npm run dev:api`.
3. Start the worker with `npm run dev:worker`.
4. Open `/health` to verify PostgreSQL, MongoDB, and Redis connectivity.

Full log ingestion, Docker agent collection, incident detection, AI summaries, and dashboard UI are later phases.

## Phase 2 APIs

Authenticated dashboard endpoints use `Authorization: Bearer <token>`.

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /projects`
- `GET /projects`
- `GET /projects/:projectId`
- `PATCH /projects/:projectId`
- `DELETE /projects/:projectId`
- `POST /projects/:projectId/api-keys`
- `GET /projects/:projectId/api-keys`
- `DELETE /api-keys/:apiKeyId`

Created API keys return the raw `key` once. Later list calls only return safe metadata: id, name, type, prefix, project id, usage, revocation, and creation timestamps.

## Phase 3 APIs

Server API keys use `x-api-key` and can send `docker`, `api`, `worker`, and `manual` logs:

- `POST /logs/ingest`

Client API keys use `x-api-key` and can only send frontend logs:

- `POST /logs/frontend`

Authenticated dashboard endpoints:

- `GET /projects/:projectId/services`
- `GET /services/:serviceId`
- `GET /services/:serviceId/logs`
- `GET /logs`
- `GET /logs/search`
- `GET /logs/:logId`

Log query parameters include `projectId`, `serviceId`, `sourceType`, `level`, `environment`, `keyword`, `from`, `to`, `statusCode`, `path`, `page`, and `limit`.

## Phase 4 APIs

The worker consumes error/fatal log jobs, writes normalized entries to `parsed_logs`, generates fingerprints, counts fingerprint frequency in Redis, and creates or updates incidents.

Authenticated incident endpoints:

- `GET /incidents`
- `GET /incidents/:incidentId`
- `PATCH /incidents/:incidentId/status`
- `GET /incidents/:incidentId/logs`

Severity is based on rolling Redis windows:

- `LOW`: 1-2 matching errors in 10 minutes
- `MEDIUM`: 3-4 matching errors in 10 minutes
- `HIGH`: 5 or more matching errors in 10 minutes
- `CRITICAL`: 3 or more fatal logs in 5 minutes

## Phase 5 APIs

AI analysis is generated on demand and is never called from log ingestion.

- `POST /incidents/:incidentId/analyze`

The current OpenAI provider is a deterministic placeholder behind an `AiProvider` interface. It stores every success/failure in MongoDB `ai_analysis_results` and copies the latest successful summary fields onto the PostgreSQL incident row for fast dashboard reads.
