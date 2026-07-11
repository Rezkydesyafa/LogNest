<a id="readme-top"></a>

<!-- PROJECT SHIELDS -->

[![NestJS][nestjs-shield]][nestjs-url]
[![TypeScript][ts-shield]][ts-url]
[![PostgreSQL][pg-shield]][pg-url]
[![MongoDB][mongo-shield]][mongo-url]
[![Redis][redis-shield]][redis-url]
[![Docker][docker-shield]][docker-url]

<br />

<h3 align="center">LogMind AI</h3>
<p align="center">
  AI-assisted centralized logging and incident platform for Docker-based applications.
</p>

---

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about">About</a></li>
    <li><a href="#key-features">Key Features</a></li>
    <li><a href="#architecture">Architecture</a></li>
    <li><a href="#tech-stack">Tech Stack</a></li>
    <li><a href="#monorepo-structure">Monorepo Structure</a></li>
    <li><a href="#getting-started">Getting Started</a></li>
    <li><a href="#environment-variables">Environment Variables</a></li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#project-status">Project Status</a></li>
    <li><a href="#license">License</a></li>
  </ol>
</details>

---

## About

LogMind AI collects logs from three sources — Docker containers, backend API responses, and frontend browser errors — then stores, correlates, and processes them into actionable incidents with AI-generated summaries.

It is designed for Docker Compose environments, local development, and internal tooling.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Key Features

- **Multi-source log ingestion** — Docker stdout/stderr, Express API responses, and browser errors flow into a single API.
- **Automatic service registry** — Services are created on first log arrival. No manual setup.
- **Error fingerprinting** — Repeated errors are grouped by normalized message, source, and path.
- **Incident detection** — Incidents are created automatically when error frequency exceeds configurable thresholds.
- **AI incident summary** — On-demand AI analysis generates root cause suggestions and action items.
- **Dashboard API** — Aggregated endpoints for service health, API performance, frontend errors, and incident overview.
- **SDK & middleware** — Drop-in Express middleware and browser SDK for log collection.
- **Separated worker** — Heavy processing (fingerprinting, incident detection) runs in a standalone worker process.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Architecture

```
┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐
│  Docker Agent   │  │ Express Services │  │  Frontend Apps    │
│  (dockerode)    │  │ (@logmind/       │  │ (@logmind/        │
│                 │  │  api-logger-     │  │  frontend-logger) │
│                 │  │  express)        │  │                   │
└────────┬────────┘  └────────┬─────────┘  └────────┬──────────┘
         │                    │                      │
         │  POST /logs/ingest │  POST /logs/ingest   │ POST /logs/frontend
         └────────────────────┼──────────────────────┘
                              ▼
                 ┌────────────────────────┐
                 │   NestJS API Server    │
                 │  (auth, ingestion,     │
                 │   search, dashboard)   │
                 └──────┬────────┬────────┘
                        │        │
                  store │        │ enqueue error/fatal
                        ▼        ▼
                 ┌──────────┐  ┌───────┐
                 │ MongoDB  │  │ Redis │
                 │ raw_logs │  │ Queue │
                 └──────────┘  └───┬───┘
                                   │
                                   ▼
                 ┌────────────────────────┐
                 │   NestJS Worker        │
                 │  (fingerprint,         │
                 │   incident detection,  │
                 │   severity scoring)    │
                 └──────────┬─────────────┘
                            │
                            ▼
                 ┌────────────────────────┐
                 │  PostgreSQL            │
                 │  (users, projects,     │
                 │   services, incidents) │
                 └────────────────────────┘
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Tech Stack

| Layer | Technology |
|---|---|
| API & Worker | NestJS, TypeScript |
| Relational DB | PostgreSQL, Prisma |
| Document DB | MongoDB, Mongoose |
| Queue | Redis, BullMQ |
| Docker Agent | Node.js, dockerode |
| Auth | JWT, bcrypt |
| Validation | class-validator, class-transformer |
| Logging | Pino |
| API Docs | Swagger / OpenAPI |
| Frontend Dashboard | Next.js *(planned)* |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Monorepo Structure

```
├── apps/
│   ├── api/              # NestJS HTTP API
│   │   └── src/
│   │       ├── common/   # Guards, interceptors, filters, decorators
│   │       ├── health/   # Health check endpoint
│   │       └── modules/  # auth, projects, api-keys, services,
│   │                     # logs, incidents, ai-analysis, dashboard
│   ├── worker/           # BullMQ log processor (standalone NestJS app)
│   └── agent/            # Docker log collector (Node.js + dockerode)
│
├── packages/
│   ├── shared/               # Constants, Prisma service, Redis service, Pino logger
│   ├── api-logger-express/   # Express middleware for API response logging
│   └── frontend-logger/      # Browser SDK for error and fetch logging
│
├── prisma/
│   └── schema.prisma     # PostgreSQL schema (User, Project, ApiKey, Service, Incident)
│
├── docker-compose.yml    # PostgreSQL, MongoDB, Redis
└── package.json          # Workspace root
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm
- Docker & Docker Compose

### Installation

1. Clone the repository:

   ```sh
   git clone https://github.com/your-username/nest-logmind.git
   cd nest-logmind
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. Copy the environment file:

   ```sh
   cp .env.example .env
   ```

4. Start infrastructure:

   ```sh
   npm run docker:up
   ```

5. Run database migrations:

   ```sh
   npm run prisma:migrate
   npm run prisma:generate
   ```

6. Start the API and worker:

   ```sh
   npm run dev:api
   npm run dev:worker
   ```

7. Verify:

   ```sh
   curl http://localhost:3000/health
   ```

   Swagger docs are available at `http://localhost:3000/docs`.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `API_PORT` | API server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `MONGODB_URL` | MongoDB connection string | — |
| `REDIS_URL` | Redis connection string | — |
| `JWT_SECRET` | Secret for signing JWT tokens | — |
| `JWT_EXPIRES_IN_SECONDS` | Token expiry in seconds | `86400` |
| `OPENAI_MODEL` | Model name for AI analysis | `gpt-4.1-mini` |
| `AI_PROVIDER_FORCE_FAIL` | Force AI provider to fail (testing) | `false` |
| `LOGMIND_API_KEY` | Server API key for the Docker agent | — |
| `LOGMIND_INGEST_ENDPOINT` | Ingestion URL for the Docker agent | — |
| `LOGMIND_AGENT_RETRY_ATTEMPTS` | Agent retry count on failure | `3` |
| `LOGMIND_AGENT_RETRY_DELAY_MS` | Delay between agent retries (ms) | `1000` |

See [`.env.example`](.env.example) for a complete template.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Usage

### Sending logs via API key

```sh
# Server-side log ingestion
curl -X POST http://localhost:3000/logs/ingest \
  -H "x-api-key: <server_api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "api",
    "serviceName": "payment-service",
    "environment": "development",
    "level": "error",
    "message": "POST /checkout returned 500",
    "timestamp": "2026-07-09T10:00:00.000Z"
  }'
```

### Express middleware

```ts
import { logmindApiLogger } from '@logmind/api-logger-express';

app.use(
  logmindApiLogger({
    apiKey: process.env.LOGMIND_API_KEY,
    serviceName: 'auth-service',
    environment: 'development',
    endpoint: 'http://localhost:3000/logs/ingest',
  }),
);
```

### Browser SDK

```ts
import { initLogMindFrontend } from '@logmind/frontend-logger';

initLogMindFrontend({
  apiKey: process.env.NEXT_PUBLIC_LOGMIND_CLIENT_KEY,
  serviceName: 'frontend-dashboard',
  environment: 'development',
  endpoint: 'http://localhost:3000/logs/frontend',
});
```

### Docker Agent

Add labels to monitored containers:

```yaml
services:
  payment-service:
    image: payment-service
    labels:
      logmind.enabled: "true"
      logmind.service: "payment-service"
      logmind.environment: "development"
```

Start the agent:

```sh
npm run dev:agent
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Roadmap

- [x] NestJS API foundation (PostgreSQL, MongoDB, Redis, BullMQ)
- [x] Authentication (register, login, JWT)
- [x] Project & API key management (server/client key separation)
- [x] Central log ingestion (`/logs/ingest`, `/logs/frontend`)
- [x] Service auto-registration
- [x] Log search & filtering with pagination
- [x] Worker with error fingerprinting & incident detection
- [x] AI incident analysis (placeholder provider behind interface)
- [x] Dashboard summary API (service health, API performance, frontend errors)
- [x] Express API logger middleware (`@logmind/api-logger-express`)
- [x] Frontend browser logger SDK (`@logmind/frontend-logger`)
- [x] Docker log agent (`apps/agent`)
- [ ] Real OpenAI provider integration
- [ ] Next.js frontend dashboard
- [ ] Full Docker Compose demo environment (all services containerized)
- [ ] Demo services (auth-service, payment-service, order-service)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Project Status

The backend API, worker, Docker agent, and both SDKs are implemented. All self-check scripts (phase 2–9) pass.

The AI provider is currently a deterministic placeholder behind an `AiProvider` interface — it can be swapped for a real OpenAI client without changing the rest of the codebase.

The Next.js frontend dashboard and containerized demo services are not yet built.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

Distributed under the MIT License.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->

[nestjs-shield]: https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white
[nestjs-url]: https://nestjs.com/
[ts-shield]: https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white
[ts-url]: https://www.typescriptlang.org/
[pg-shield]: https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white
[pg-url]: https://www.postgresql.org/
[mongo-shield]: https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white
[mongo-url]: https://www.mongodb.com/
[redis-shield]: https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white
[redis-url]: https://redis.io/
[docker-shield]: https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white
[docker-url]: https://www.docker.com/
