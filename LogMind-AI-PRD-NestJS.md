# Product Requirements Document

# LogMind AI — Centralized Log & Incident Platform for Docker-Based Applications

## 1. Ringkasan Produk

**LogMind AI** adalah platform observability sederhana berbasis **NestJS** yang berfungsi sebagai pusat pengumpulan log dari berbagai aplikasi atau service yang berjalan di Docker.

LogMind AI mengumpulkan tiga jenis log utama:

1. **Docker container logs**
   Log dari container Docker seperti `stdout`, `stderr`, runtime logs, worker logs, dan container error output.

2. **API request/response logs**
   Log dari aplikasi backend, termasuk endpoint, HTTP method, status code, response time, request ID, IP address, user agent, dan error response.

3. **Frontend client logs**
   Log dari aplikasi frontend seperti JavaScript error, unhandled promise rejection, failed API request, browser metadata, page URL, dan frontend route.

Semua log dikirim ke LogMind AI agar developer dapat memantau error, API failure, response time, dan incident secara terpusat.

Tujuan akhirnya adalah membuat **mini observability platform** untuk Docker Compose, local development, internal development environment, dan portfolio backend engineering.

---

## 2. Product Positioning

LogMind AI bukan clone penuh dari Datadog, Sentry, Grafana Loki, Elastic Stack, atau OpenTelemetry platform.

LogMind AI diposisikan sebagai:

```txt
AI-assisted centralized logging and incident platform for Docker-based applications.
```

Versi Indonesia:

```txt
Platform terpusat berbasis NestJS untuk menangkap log Docker, response API, dan error frontend dari berbagai aplikasi berbasis Docker, lalu membantu developer memahami incident menggunakan AI.
```

Fokus utama produk:

* Mengumpulkan log dari banyak service.
* Menyatukan log backend, frontend, dan Docker container.
* Menghubungkan log berdasarkan project, service, environment, dan request ID.
* Mendeteksi error berulang.
* Membuat incident otomatis.
* Memberikan AI summary untuk membantu debugging.
* Menyediakan REST API untuk dashboard frontend.
* Menjadi portfolio backend project yang menunjukkan kemampuan system design, NestJS architecture, queue processing, worker architecture, database design, Docker integration, SDK design, dan AI integration.

---

## 3. Problem Statement

Developer sering menjalankan banyak aplikasi atau service secara bersamaan, misalnya:

```txt
auth-service
payment-service
order-service
notification-service
frontend-dashboard
admin-panel
worker-service
```

Jika semua berjalan di Docker, log biasanya tersebar di banyak tempat:

```txt
docker logs auth-service
docker logs payment-service
terminal backend
browser console frontend
API error response
worker logs
background job logs
```

Masalah utama:

1. Log tersebar di banyak container.
2. Error backend dan error frontend tidak terhubung.
3. Response API lambat sulit dilacak.
4. Developer harus membuka banyak terminal.
5. Error yang sama bisa muncul berkali-kali tanpa disadari.
6. Tidak ada incident otomatis.
7. Tidak ada ringkasan AI untuk memahami masalah.
8. Sulit melihat service mana yang paling sering bermasalah.
9. Sulit memahami hubungan antara Docker log, API failure, dan frontend error.

LogMind AI menyelesaikan masalah ini dengan menjadikan semua log dari berbagai sumber sebagai satu pusat observability sederhana.

---

## 4. Goals

Tujuan utama LogMind AI adalah:

1. Menangkap log dari banyak Docker container.
2. Menangkap request dan response API dari aplikasi backend.
3. Menangkap error dan failed request dari aplikasi frontend.
4. Menyimpan semua log secara terpusat.
5. Menghubungkan log dengan project, service, environment, dan request ID.
6. Mendeteksi pola error berulang.
7. Membuat incident otomatis berdasarkan rule.
8. Menghasilkan AI summary untuk incident.
9. Menyediakan REST API untuk dashboard frontend.
10. Menjadi portfolio backend project yang menunjukkan kemampuan:

```txt
NestJS architecture
Modular backend design
Guards, interceptors, pipes, filters
Queue processing
Worker architecture
MongoDB + PostgreSQL data design
Redis + BullMQ
Docker integration
API key security
JWT authentication
AI integration
SDK and middleware design
Dashboard API design
```

---

## 5. Target Pengguna

## 5.1 Backend Developer

Backend developer yang menjalankan banyak service menggunakan Docker Compose.

Kebutuhan:

* Melihat semua log backend di satu tempat.
* Melihat error per service.
* Melihat response time API.
* Melihat status code 4xx/5xx.
* Melihat incident dari error berulang.
* Menghubungkan request antar service menggunakan request ID.

---

## 5.2 Frontend Developer

Frontend developer yang ingin mengetahui error browser dan failed API request.

Kebutuhan:

* Melihat JavaScript error.
* Melihat halaman yang menyebabkan error.
* Melihat API request frontend yang gagal.
* Melihat browser, device, dan user agent.
* Menghubungkan frontend error dengan backend request melalui request ID.

---

## 5.3 Tech Lead / Reviewer Portfolio

Tech lead, interviewer, atau reviewer portfolio yang ingin melihat kemampuan backend engineering.

Kebutuhan:

* Melihat architecture backend yang rapi.
* Melihat service yang paling sering error.
* Melihat endpoint API yang paling banyak gagal.
* Melihat incident aktif.
* Membaca AI summary tanpa membaca semua raw logs.
* Melihat trade-off antara MongoDB, PostgreSQL, Redis, queue, worker, dan API.

---

## 6. Scope MVP

MVP LogMind AI fokus pada:

1. User authentication.
2. Project/workspace.
3. API key untuk mengirim log.
4. Service registry.
5. Central log ingestion API.
6. Docker log collector.
7. API response logger middleware untuk Express.js demo services.
8. Frontend error logger SDK sederhana.
9. Raw log storage di MongoDB.
10. Relational data di PostgreSQL.
11. Queue processing dengan Redis + BullMQ.
12. Error fingerprinting.
13. Incident detection.
14. AI incident summary.
15. Dashboard summary API.
16. Docker Compose demo environment.

---

## 7. Non-Goals MVP

Untuk MVP, LogMind AI tidak akan fokus pada:

1. Kubernetes log collection.
2. Distributed tracing lengkap.
3. Metrics seperti CPU, RAM, network, dan disk.
4. Full text search engine seperti Elasticsearch.
5. Alerting production-grade ke Slack, Discord, atau Email.
6. RBAC team kompleks.
7. Billing/subscription system.
8. High-scale enterprise log storage.
9. Real-time WebSocket dashboard.
10. Root cause analysis yang benar-benar akurat 100%.
11. Multi-tenant SaaS production.
12. OpenTelemetry full integration.
13. Production-grade hosted observability SaaS.

---

# 8. Technology Stack

## 8.1 Core Backend API

Backend utama menggunakan:

```txt
NestJS
TypeScript
Prisma
PostgreSQL
Mongoose
MongoDB
Redis
BullMQ
JWT
Swagger/OpenAPI
Pino
Zod atau class-validator
```

Backend utama bertanggung jawab untuk:

* Auth.
* Project management.
* API key management.
* Service registry.
* Log ingestion.
* Log search/filter.
* Incident API.
* AI analysis endpoint.
* Dashboard summary API.

---

## 8.2 Worker

Worker menggunakan:

```txt
NestJS standalone application
BullMQ
Redis
Prisma
Mongoose
Pino
AI provider client
```

Worker berjalan terpisah dari API agar proses berat tidak memperlambat endpoint ingestion.

Worker bertanggung jawab untuk:

* Consume log processing queue.
* Normalize log message.
* Generate fingerprint.
* Detect repeated error.
* Create/update incident.
* Trigger AI summary jika diperlukan.

---

## 8.3 Docker Agent

Docker Agent menggunakan:

```txt
Node.js
TypeScript
dockerode
Pino
Fetch/Axios
```

Agent berjalan sebagai container dan membaca Docker logs dari container yang memiliki label khusus.

---

## 8.4 Frontend Dashboard

Frontend dashboard menggunakan:

```txt
Next.js
React
TypeScript
Tailwind CSS
shadcn/ui
TanStack Query
```

---

## 8.5 SDK dan Middleware

LogMind menyediakan dua package utama:

```txt
@logmind/api-logger-express
@logmind/frontend-logger
```

Package pertama digunakan oleh backend Express.js demo services untuk mengirim API response logs ke LogMind.

Package kedua digunakan oleh aplikasi frontend/browser untuk mengirim frontend error logs ke LogMind.

---

# 9. High-Level Architecture

```txt
[Dockerized Applications]
 auth-service
 payment-service
 order-service
 worker-service
 frontend-dashboard
        |
        | Docker logs
        v
[LogMind Docker Agent]
        |
        v
[LogMind NestJS Ingestion API]
        |
        | API response logs
        | Frontend error logs
        v
[MongoDB: Raw Logs]
        |
        v
[Redis Queue]
        |
        v
[LogMind NestJS Worker]
        |
        | parse log
        | normalize log
        | generate fingerprint
        | detect incident
        | request AI summary
        v
[PostgreSQL: Users, Projects, Services, Incidents]
        |
        v
[NestJS Dashboard API]
        |
        v
[Next.js Frontend Dashboard]
```

---

# 10. System Components

## 10.1 LogMind NestJS API

LogMind API adalah backend utama berbasis NestJS.

Tanggung jawab:

* User authentication.
* Project management.
* API key management.
* Service registry.
* Log ingestion.
* Log query/filter.
* Incident query.
* Dashboard summary API.
* AI summary endpoint.
* Swagger/OpenAPI docs.

API harus modular dan mengikuti konsep NestJS:

```txt
Module
Controller
Service
Provider
Guard
Interceptor
Pipe
Filter
Decorator
```

---

## 10.2 LogMind NestJS Worker

Worker berjalan sebagai aplikasi NestJS terpisah dari API.

Tanggung jawab:

* Mengambil job dari Redis queue.
* Memproses raw logs.
* Membuat parsed logs.
* Generate fingerprint.
* Menghitung frekuensi error.
* Membuat incident otomatis.
* Memanggil AI provider untuk incident summary.
* Menyimpan hasil analisis.

Worker tidak boleh memblokir ingestion API.

---

## 10.3 LogMind Docker Agent

Docker Agent adalah service kecil yang berjalan sebagai Docker container.

Tanggung jawab:

* Membaca container yang memiliki label `logmind.enabled=true`.
* Membaca log dari container tersebut.
* Menambahkan metadata container.
* Mengirim log ke LogMind API.
* Menghindari membaca log dari dirinya sendiri.
* Melakukan retry sederhana jika API down.

Contoh label Docker:

```yaml
services:
  payment-service:
    image: payment-service
    labels:
      logmind.enabled: "true"
      logmind.service: "payment-service"
      logmind.environment: "development"
```

---

## 10.4 API Logger Middleware

Middleware untuk aplikasi backend Express.js agar response API dapat dikirim ke LogMind.

Contoh penggunaan:

```ts
import { logmindApiLogger } from "@logmind/api-logger-express";

app.use(
  logmindApiLogger({
    apiKey: process.env.LOGMIND_API_KEY!,
    serviceName: "auth-service",
    environment: "development",
    endpoint: "http://logmind-api:4000/logs/ingest",
    maskFields: ["password", "token", "authorization", "cookie"]
  })
);
```

Middleware menangkap:

```txt
method
path
statusCode
durationMs
requestId
userAgent
ip
errorMessage
serviceName
environment
```

Middleware tidak boleh mengirim data sensitif seperti password, token, cookie, dan authorization header.

---

## 10.5 Frontend Logger SDK

SDK ringan untuk frontend/browser.

Contoh penggunaan:

```ts
import { initLogMindFrontend } from "@logmind/frontend-logger";

initLogMindFrontend({
  apiKey: process.env.NEXT_PUBLIC_LOGMIND_CLIENT_KEY!,
  serviceName: "frontend-dashboard",
  environment: "development",
  endpoint: "http://localhost:4000/logs/frontend"
});
```

SDK menangkap:

```txt
window.onerror
unhandledrejection
failed fetch request
page URL
browser metadata
user agent
frontend route
```

---

# 11. Core Features

## 11.1 Authentication

User dapat register dan login.

Endpoint:

```http
POST /auth/register
POST /auth/login
GET /auth/me
```

Acceptance criteria:

* Password di-hash menggunakan bcrypt atau argon2.
* Login menghasilkan JWT access token.
* Endpoint protected membutuhkan JWT.
* User hanya bisa mengakses project miliknya.
* Auth menggunakan NestJS Guard.
* Current user dapat diakses melalui custom decorator.

Contoh NestJS components:

```txt
AuthModule
AuthController
AuthService
JwtStrategy
JwtAuthGuard
CurrentUserDecorator
```

---

## 11.2 Project Management

Project digunakan untuk mengelompokkan banyak aplikasi/service.

Contoh:

```txt
Project: Ecommerce Platform

Services:
- auth-service
- payment-service
- order-service
- frontend-dashboard
```

Endpoint:

```http
POST /projects
GET /projects
GET /projects/:projectId
PATCH /projects/:projectId
DELETE /projects/:projectId
```

Acceptance criteria:

* User bisa membuat project.
* User bisa melihat daftar project miliknya.
* Project memiliki banyak service.
* Project memiliki API key untuk ingestion.
* User tidak bisa mengakses project milik user lain.

NestJS components:

```txt
ProjectsModule
ProjectsController
ProjectsService
ProjectOwnershipGuard
```

---

## 11.3 API Key Management

API key digunakan oleh Docker Agent, backend middleware, dan frontend SDK untuk mengirim log.

Endpoint:

```http
POST /projects/:projectId/api-keys
GET /projects/:projectId/api-keys
DELETE /api-keys/:apiKeyId
```

Jenis API key:

```txt
server_key:
- dipakai Docker Agent dan backend API logger
- boleh digunakan di server-side
- bisa mengirim docker/api/worker/manual logs

client_key:
- dipakai frontend SDK
- permission lebih terbatas
- hanya bisa mengirim frontend logs
- tidak boleh membaca data
```

Acceptance criteria:

* API key disimpan dalam bentuk hash.
* API key mentah hanya muncul sekali saat dibuat.
* API key bisa di-revoke.
* Client key hanya bisa mengirim frontend logs.
* Server key bisa mengirim docker logs dan API logs.
* API key memiliki prefix agar mudah dikenali tanpa menyimpan raw key.
* API key validation menggunakan NestJS Guard.

NestJS components:

```txt
ApiKeysModule
ApiKeysController
ApiKeysService
ApiKeyGuard
ApiKeyProjectContextProvider
```

---

## 11.4 Service Registry

Service adalah aplikasi atau sistem yang mengirim log ke LogMind.

Contoh service:

```txt
auth-service
payment-service
order-service
frontend-dashboard
admin-panel
worker-service
```

Service bisa dibuat otomatis saat log pertama masuk.

Endpoint:

```http
GET /projects/:projectId/services
GET /services/:serviceId
GET /services/:serviceId/logs
GET /services/:serviceId/incidents
```

Acceptance criteria:

* Service auto-created berdasarkan `serviceName`.
* Service terkait ke project.
* Service menyimpan environment.
* Service menyimpan source types.
* Service menyimpan metadata terakhir.
* Service memiliki `lastSeenAt`.
* Service dapat menampilkan jumlah logs, errors, dan incidents.

NestJS components:

```txt
ServicesModule
ServicesController
ServicesService
```

---

## 11.5 Central Log Ingestion

Endpoint utama untuk menerima semua jenis log server-side.

Endpoint:

```http
POST /logs/ingest
```

Header:

```http
x-api-key: <api_key>
```

Payload minimal:

```json
{
  "sourceType": "docker",
  "serviceName": "payment-service",
  "environment": "development",
  "level": "error",
  "message": "Database connection timeout",
  "timestamp": "2026-07-08T10:30:00.000Z"
}
```

Supported `sourceType`:

```txt
docker
api
frontend
worker
manual
```

Supported `level`:

```txt
debug
info
warn
error
fatal
```

Acceptance criteria:

* Payload divalidasi menggunakan DTO + Pipe.
* API key wajib valid.
* Server key dapat mengirim docker/api/worker/manual logs.
* Client key tidak boleh mengirim log ke endpoint ini.
* Log valid disimpan ke MongoDB.
* Service dibuat otomatis jika belum ada.
* Log error/fatal dikirim ke Redis queue.
* Slow API response dapat dikirim ke Redis queue sebagai warning.
* Response ingestion cepat.
* Endpoint tidak menunggu AI analysis.

Response sukses:

```json
{
  "success": true,
  "logId": "raw_log_id",
  "queued": true
}
```

NestJS components:

```txt
LogsModule
LogsController
LogsService
RawLogsRepository
LogIngestionDto
ApiKeyGuard
LogQueueProducer
```

---

## 11.6 Frontend Log Ingestion

Endpoint khusus frontend.

Endpoint:

```http
POST /logs/frontend
```

Header:

```http
x-api-key: <client_api_key>
```

Acceptance criteria:

* Hanya client key yang boleh mengirim frontend logs.
* Frontend logs tidak boleh mengandung data sensitif.
* Payload divalidasi menggunakan DTO + Pipe.
* Log disimpan ke MongoDB.
* Jika level error/fatal, log dikirim ke Redis queue.
* Client key tidak dapat membaca data dashboard.

NestJS components:

```txt
FrontendLogDto
ClientApiKeyGuard
LogsService
LogQueueProducer
```

---

## 11.7 Docker Log Collection

LogMind Agent membaca log dari Docker container.

Requirements:

* Agent berjalan sebagai container.
* Agent membaca Docker socket atau Docker log files.
* Agent hanya collect container dengan label:

```txt
logmind.enabled=true
```

Agent membaca metadata:

```txt
container ID
container name
image
labels
compose project
environment
service name
stream stdout/stderr
```

Acceptance criteria:

* Container tanpa label tidak dipantau.
* Container dengan label dipantau otomatis.
* Log stdout/stderr masuk ke LogMind.
* Agent tidak mengirim log dirinya sendiri.
* Jika API down, agent melakukan retry sederhana.
* Agent menambahkan metadata container sebelum mengirim log.

---

## 11.8 API Response Logger

Backend service bisa memasang middleware Express.js untuk mengirim API response log.

Requirements:

* Middleware tersedia sebagai package terpisah.
* Middleware menangkap request/response.
* Middleware mengirim log ke `/logs/ingest`.
* Middleware tidak boleh membocorkan data sensitif.
* Middleware harus bisa mask field seperti password, token, authorization, dan cookie.
* Middleware harus non-blocking dan tidak mengganggu response utama aplikasi.

Field yang ditangkap:

```txt
method
path
statusCode
durationMs
requestId
ip
userAgent
errorMessage
serviceName
environment
```

Acceptance criteria:

* Response 2xx dicatat sebagai info jika enabled.
* Response 4xx dicatat sebagai warn.
* Response 5xx dicatat sebagai error.
* Slow response dicatat sebagai warn.
* Sensitive fields tidak dikirim.
* Jika LogMind API down, aplikasi utama tetap berjalan.

---

## 11.9 Frontend Error Logger

Frontend app bisa mengirim error ke LogMind.

Requirements:

* SDK JavaScript sederhana.
* Bisa menangkap `window.onerror`.
* Bisa menangkap `unhandledrejection`.
* Bisa mengirim failed API request.
* Bisa menyimpan page URL, browser, user agent.
* Bisa menggunakan client API key.

Acceptance criteria:

* JavaScript error muncul di dashboard.
* Failed API request muncul sebagai frontend log.
* Frontend log menggunakan client key.
* Client key tidak dapat membaca data.
* SDK tidak crash jika LogMind API down.

---

## 11.10 Log Search & Filtering

User dapat mencari log secara terpusat.

Endpoint:

```http
GET /logs
GET /logs/search
GET /logs/:logId
```

Query parameters:

```txt
projectId
serviceId
sourceType
level
environment
keyword
from
to
statusCode
path
page
limit
```

Acceptance criteria:

* User bisa melihat log dari semua service dalam satu project.
* User bisa filter berdasarkan source type.
* User bisa filter berdasarkan service.
* User bisa filter berdasarkan level.
* User bisa mencari log berdasarkan keyword.
* Pagination wajib tersedia.
* User hanya bisa melihat log dari project miliknya.
* Query validation menggunakan DTO.

NestJS components:

```txt
LogsController
LogsService
LogQueryDto
ProjectOwnershipGuard
```

---

## 11.11 Error Fingerprinting

LogMind membuat fingerprint untuk mengelompokkan error serupa.

Fingerprint dibuat dari:

```txt
projectId
serviceName
sourceType
level
normalizedMessage
stackTraceHash
statusCode
path
```

Contoh fingerprint:

```txt
payment-service:api:error:POST:/checkout:500:database_timeout
```

Acceptance criteria:

* Error yang sama menghasilkan fingerprint yang sama.
* Error berbeda menghasilkan fingerprint berbeda.
* Fingerprint disimpan di parsed log.
* Fingerprint digunakan untuk incident detection.
* Normalisasi message menghapus angka, ID, UUID, timestamp, dan value yang berubah-ubah.

NestJS components:

```txt
FingerprintService
LogNormalizerService
ParsedLogsRepository
```

---

## 11.12 Incident Detection

Incident dibuat otomatis ketika error berulang.

Default rule MVP:

```txt
Jika error dengan fingerprint yang sama muncul >= 5 kali dalam 10 menit,
buat incident severity = high.
```

Severity rule MVP:

```txt
low:
- error muncul 1-2 kali dalam 10 menit

medium:
- error muncul 3-4 kali dalam 10 menit

high:
- error muncul >= 5 kali dalam 10 menit

critical:
- fatal error muncul >= 3 kali dalam 5 menit
```

Endpoint:

```http
GET /incidents
GET /incidents/:incidentId
PATCH /incidents/:incidentId/status
GET /incidents/:incidentId/logs
```

Acceptance criteria:

* Incident dibuat otomatis dari error berulang.
* Incident tidak duplikat jika fingerprint sama dan status masih open.
* Incident menyimpan `firstSeenAt`.
* Incident menyimpan `lastSeenAt`.
* Incident menyimpan severity.
* Incident menyimpan error count.
* Incident bisa diubah statusnya.
* Incident dapat menampilkan sample logs.

NestJS components:

```txt
IncidentsModule
IncidentsController
IncidentsService
IncidentDetectionService
IncidentRepository
```

---

## 11.13 AI Incident Summary

AI digunakan untuk merangkum incident.

Endpoint:

```http
POST /incidents/:incidentId/analyze
```

AI input:

```txt
service name
source type
error message
sample logs
API endpoint terkait
status code
response time
stack trace
first seen
last seen
frequency
frontend page URL jika ada
```

AI output:

```json
{
  "summary": "Payment service mengalami error 500 berulang pada endpoint /checkout.",
  "possibleCause": "Kemungkinan terjadi database timeout atau connection pool penuh.",
  "impact": "User mungkin gagal melakukan checkout.",
  "suggestedActions": [
    "Periksa koneksi database.",
    "Cek query lambat di endpoint /checkout.",
    "Periksa connection pool.",
    "Lihat log frontend yang memiliki requestId sama."
  ],
  "confidence": "medium"
}
```

Acceptance criteria:

* AI summary dapat dibuat dari incident.
* AI summary disimpan agar tidak perlu regenerate terus-menerus.
* Jika AI gagal, incident tetap tersedia.
* AI output divalidasi dengan schema.
* AI tidak dipanggil untuk setiap log.
* User dapat melihat sample log asli untuk verifikasi manual.

NestJS components:

```txt
AiAnalysisModule
AiAnalysisService
AiProvider
OpenAiProvider
AiAnalysisSchemaValidator
```

---

## 11.14 Central Dashboard API

Dashboard menampilkan kondisi seluruh aplikasi dalam satu project.

Endpoint:

```http
GET /dashboard/summary?projectId=<projectId>
GET /dashboard/services-health?projectId=<projectId>
GET /dashboard/api-performance?projectId=<projectId>
GET /dashboard/frontend-errors?projectId=<projectId>
```

Contoh response:

```json
{
  "totalServices": 8,
  "totalLogsToday": 5400,
  "dockerLogsToday": 3200,
  "apiLogsToday": 1800,
  "frontendLogsToday": 400,
  "errorLogsToday": 230,
  "openIncidents": 5,
  "criticalIncidents": 1,
  "topErrorServices": [
    {
      "serviceName": "payment-service",
      "errorCount": 90
    }
  ],
  "slowestApiEndpoints": [
    {
      "serviceName": "order-service",
      "path": "/orders",
      "avgDurationMs": 1300
    }
  ],
  "recentIncidents": [
    {
      "id": "incident_123",
      "serviceName": "payment-service",
      "title": "Repeated 500 error on /checkout",
      "severity": "high",
      "status": "open"
    }
  ]
}
```

Acceptance criteria:

* Dashboard menampilkan ringkasan semua service.
* Dashboard membedakan docker/api/frontend logs.
* Dashboard menampilkan open incidents.
* Dashboard menampilkan critical incidents.
* Dashboard menampilkan service paling bermasalah.
* Dashboard menampilkan endpoint API lambat.
* Data hanya milik project user.

NestJS components:

```txt
DashboardModule
DashboardController
DashboardService
ProjectOwnershipGuard
```

---

# 12. Data Storage Design

## 12.1 PostgreSQL

PostgreSQL digunakan untuk data relasional dan data yang butuh konsistensi.

Tables:

```txt
users
projects
api_keys
services
incidents
incident_events
alert_rules
```

### users

```txt
id
name
email
password_hash
created_at
updated_at
```

### projects

```txt
id
user_id
name
description
created_at
updated_at
```

### api_keys

```txt
id
project_id
name
key_hash
prefix
type
revoked_at
last_used_at
created_at
```

Field `type`:

```txt
server_key
client_key
```

### services

```txt
id
project_id
name
environment
source_types
container_name
image
last_seen_at
created_at
updated_at
```

### incidents

```txt
id
project_id
service_id
fingerprint
title
severity
status
source_type
error_count
first_seen_at
last_seen_at
ai_summary
ai_possible_cause
ai_impact
ai_suggested_actions
ai_confidence
created_at
updated_at
```

### incident_events

```txt
id
incident_id
event_type
message
metadata
created_at
```

### alert_rules

```txt
id
project_id
name
source_type
level
threshold_count
window_minutes
severity
enabled
created_at
updated_at
```

---

## 12.2 MongoDB

MongoDB digunakan untuk raw logs karena bentuk log fleksibel.

Collections:

```txt
raw_logs
parsed_logs
ai_analysis_results
```

### raw_logs

```json
{
  "_id": "ObjectId",
  "projectId": "project_123",
  "serviceId": "service_123",
  "sourceType": "api",
  "serviceName": "payment-service",
  "environment": "development",
  "level": "error",
  "message": "POST /checkout returned 500",
  "timestamp": "2026-07-08T10:30:00.000Z",
  "container": {
    "id": "abc123",
    "name": "payment-service-1",
    "image": "payment-service:latest"
  },
  "request": {
    "method": "POST",
    "path": "/checkout",
    "requestId": "req_123"
  },
  "response": {
    "statusCode": 500,
    "durationMs": 920,
    "errorMessage": "Database timeout"
  },
  "frontend": {
    "pageUrl": "/checkout",
    "browser": "Chrome"
  },
  "metadata": {},
  "stackTrace": "Error: Database timeout...",
  "createdAt": "2026-07-08T10:30:01.000Z"
}
```

### parsed_logs

```json
{
  "_id": "ObjectId",
  "rawLogId": "ObjectId",
  "projectId": "project_123",
  "serviceId": "service_123",
  "sourceType": "api",
  "level": "error",
  "normalizedMessage": "POST /checkout returned <status_code>",
  "fingerprint": "payment-service:api:error:checkout:500:database_timeout",
  "stackTraceHash": "8d91a2",
  "createdAt": "2026-07-08T10:30:02.000Z"
}
```

### ai_analysis_results

```json
{
  "_id": "ObjectId",
  "incidentId": "incident_123",
  "projectId": "project_123",
  "inputSnapshot": {},
  "output": {
    "summary": "...",
    "possibleCause": "...",
    "impact": "...",
    "suggestedActions": [],
    "confidence": "medium"
  },
  "provider": "openai",
  "model": "gpt-4.1-mini",
  "createdAt": "2026-07-08T10:35:00.000Z"
}
```

---

# 13. NestJS Backend Architecture

## 13.1 Recommended Monorepo Structure

```txt
apps/
  api/
    src/
      main.ts
      app.module.ts

      common/
        decorators/
          current-user.decorator.ts
          project-context.decorator.ts

        guards/
          jwt-auth.guard.ts
          api-key.guard.ts
          client-api-key.guard.ts
          project-ownership.guard.ts

        filters/
          http-exception.filter.ts

        interceptors/
          request-id.interceptor.ts
          logging.interceptor.ts
          response-transform.interceptor.ts

        pipes/
          zod-validation.pipe.ts

        utils/
          mask-sensitive-data.ts
          fingerprint.ts
          pagination.ts

      config/
        env.config.ts
        postgres.config.ts
        mongodb.config.ts
        redis.config.ts
        swagger.config.ts

      infrastructure/
        prisma/
          prisma.module.ts
          prisma.service.ts

        mongoose/
          mongoose.module.ts

        queues/
          queues.module.ts
          log.queue.ts
          incident.queue.ts

        ai/
          ai-provider.interface.ts
          openai.provider.ts

      modules/
        auth/
          auth.module.ts
          auth.controller.ts
          auth.service.ts
          dto/
          strategies/

        users/
          users.module.ts
          users.service.ts

        projects/
          projects.module.ts
          projects.controller.ts
          projects.service.ts
          dto/

        api-keys/
          api-keys.module.ts
          api-keys.controller.ts
          api-keys.service.ts
          dto/

        services/
          services.module.ts
          services.controller.ts
          services.service.ts
          dto/

        logs/
          logs.module.ts
          logs.controller.ts
          logs.service.ts
          dto/
          schemas/
            raw-log.schema.ts
            parsed-log.schema.ts

        incidents/
          incidents.module.ts
          incidents.controller.ts
          incidents.service.ts
          incident-detection.service.ts
          dto/

        dashboard/
          dashboard.module.ts
          dashboard.controller.ts
          dashboard.service.ts

        ai-analysis/
          ai-analysis.module.ts
          ai-analysis.service.ts
          dto/

  worker/
    src/
      main.ts
      worker.module.ts
      processors/
        log.processor.ts
        incident.processor.ts

      modules/
        log-processing/
          log-processing.module.ts
          log-processing.service.ts

        incident-processing/
          incident-processing.module.ts
          incident-processing.service.ts

  agent/
    src/
      main.ts
      docker/
        docker-client.ts
        container-watcher.ts
        log-streamer.ts
      sender/
        logmind-client.ts

  dashboard/
    app/
    components/
    lib/

packages/
  shared/
    src/
      log-types.ts
      schemas.ts
      constants.ts

  api-logger-express/
    src/
      index.ts
      middleware.ts
      mask.ts

  frontend-logger/
    src/
      index.ts
      browser-listeners.ts
      fetch-instrumentation.ts
```

---

## 13.2 NestJS Architecture Rules

Agar project tetap maintainable:

1. Controller hanya menerima request dan mengembalikan response.
2. Business logic harus berada di service.
3. Database access berada di service atau repository.
4. Auth dan API key validation menggunakan guard.
5. Request validation menggunakan DTO + pipe.
6. Error handling menggunakan global exception filter.
7. Cross-cutting concern menggunakan interceptor.
8. Queue producer dipisahkan dari consumer.
9. Worker tidak berada di process yang sama dengan API.
10. AI provider dibuat sebagai interface agar mudah diganti.

---

## 13.3 Module Responsibility

### AuthModule

Tanggung jawab:

* Register.
* Login.
* JWT generation.
* JWT validation.
* Current user.

---

### ProjectsModule

Tanggung jawab:

* CRUD project.
* Project ownership validation.
* Project context untuk endpoint dashboard/logs.

---

### ApiKeysModule

Tanggung jawab:

* Generate API key.
* Hash API key.
* Validate API key.
* Revoke API key.
* Update `lastUsedAt`.

---

### ServicesModule

Tanggung jawab:

* Service auto-registration.
* Service metadata update.
* Service query.
* Service detail.

---

### LogsModule

Tanggung jawab:

* Log ingestion.
* Frontend log ingestion.
* Raw log storage.
* Log search/filter.
* Push error logs to queue.

---

### IncidentsModule

Tanggung jawab:

* Incident query.
* Incident status update.
* Incident logs.
* Incident detection service.

---

### AiAnalysisModule

Tanggung jawab:

* Build AI prompt.
* Call AI provider.
* Validate AI output.
* Store AI analysis result.
* Update incident AI summary fields.

---

### DashboardModule

Tanggung jawab:

* Project summary.
* Service health.
* API performance.
* Frontend errors.
* Recent incidents.

---

# 14. API Endpoints

## Auth

```http
POST /auth/register
POST /auth/login
GET /auth/me
```

## Projects

```http
POST /projects
GET /projects
GET /projects/:projectId
PATCH /projects/:projectId
DELETE /projects/:projectId
```

## API Keys

```http
POST /projects/:projectId/api-keys
GET /projects/:projectId/api-keys
DELETE /api-keys/:apiKeyId
```

## Services

```http
GET /projects/:projectId/services
GET /services/:serviceId
GET /services/:serviceId/logs
GET /services/:serviceId/incidents
```

## Logs

```http
POST /logs/ingest
POST /logs/frontend
GET /logs
GET /logs/search
GET /logs/:logId
```

## Incidents

```http
GET /incidents
GET /incidents/:incidentId
PATCH /incidents/:incidentId/status
GET /incidents/:incidentId/logs
POST /incidents/:incidentId/analyze
```

## Dashboard

```http
GET /dashboard/summary
GET /dashboard/services-health
GET /dashboard/api-performance
GET /dashboard/frontend-errors
```

---

# 15. Functional Requirements Summary

| ID     | Requirement                                                 | Priority    |
| ------ | ----------------------------------------------------------- | ----------- |
| FR-001 | User dapat register dan login                               | Must Have   |
| FR-002 | User dapat membuat project                                  | Must Have   |
| FR-003 | User dapat membuat server API key dan client API key        | Must Have   |
| FR-004 | Central ingestion API menerima multi-source logs            | Must Have   |
| FR-005 | Raw logs tersimpan di MongoDB                               | Must Have   |
| FR-006 | Service registry otomatis dari log masuk                    | Must Have   |
| FR-007 | Error/fatal logs masuk ke Redis queue                       | Must Have   |
| FR-008 | Worker membuat fingerprint error                            | Must Have   |
| FR-009 | Worker membuat incident otomatis                            | Must Have   |
| FR-010 | Docker Agent dapat membaca log container berlabel           | Must Have   |
| FR-011 | Backend middleware Express dapat mengirim API response logs | Must Have   |
| FR-012 | Frontend SDK dapat mengirim frontend error logs             | Must Have   |
| FR-013 | User dapat mencari dan filter log                           | Must Have   |
| FR-014 | User dapat melihat dashboard summary                        | Must Have   |
| FR-015 | User dapat generate AI incident summary                     | Must Have   |
| FR-016 | Dashboard menampilkan API performance                       | Should Have |
| FR-017 | Dashboard menampilkan frontend errors                       | Should Have |
| FR-018 | Upload file log manual                                      | Could Have  |
| FR-019 | Slack/GitHub integration                                    | Future      |
| FR-020 | Kubernetes support                                          | Future      |

---

# 16. Non-Functional Requirements

## 16.1 Performance

* `/logs/ingest` harus cepat.
* Ingestion tidak boleh menunggu AI analysis.
* Error analysis dilakukan async via queue.
* Endpoint log wajib menggunakan pagination.
* Dashboard summary boleh menggunakan aggregation sederhana untuk MVP.
* Middleware logger tidak boleh memperlambat aplikasi utama secara signifikan.
* Queue hanya digunakan untuk logs yang relevan seperti error, fatal, dan slow response.

---

## 16.2 Reliability

* Worker memiliki retry.
* Agent memiliki retry sederhana jika API down.
* Jika AI provider gagal, incident tetap dibuat.
* Jika satu log gagal diproses, log lain tetap berjalan.
* Failed jobs harus bisa dilihat di log worker.
* Middleware SDK tidak boleh crash jika LogMind API tidak tersedia.
* Queue processing harus idempotent untuk menghindari duplicate incident.

---

## 16.3 Security

* Password di-hash.
* API key di-hash.
* JWT untuk dashboard API.
* Server key dan client key harus dipisah.
* Client key hanya bisa mengirim frontend logs.
* Sensitive fields harus di-mask.
* Docker socket mount hanya untuk local demo.
* Rate limiting diterapkan untuk ingestion dan AI analyze.
* Request body logging harus dibatasi.
* Authorization header, cookies, token, dan password tidak boleh disimpan.
* User hanya bisa membaca data project miliknya.

---

## 16.4 Maintainability

* TypeScript wajib.
* Struktur folder modular.
* Menggunakan NestJS module pattern.
* Validasi request menggunakan DTO.
* Error handling terpusat.
* Logger internal menggunakan Pino.
* API docs menggunakan Swagger/OpenAPI.
* `.env.example` wajib tersedia.
* README menjelaskan arsitektur dan trade-off.
* Controller tidak boleh berisi business logic berat.
* Service layer harus menjadi pusat business logic.
* Worker dan API dipisah secara process dan tanggung jawab.

---

# 17. Docker Compose Demo Environment

Untuk portfolio, project harus menyediakan demo environment.

Services:

```txt
logmind-api
logmind-worker
logmind-agent
postgres
mongodb
redis
frontend-dashboard
demo-auth-service
demo-payment-service
demo-order-service
```

Demo flow:

```txt
1. User menjalankan docker compose up.
2. Demo services menghasilkan log normal dan error.
3. LogMind Agent menangkap Docker logs.
4. API middleware menangkap response API dari demo services.
5. Frontend SDK menangkap frontend error dari dashboard demo.
6. Semua log dikirim ke LogMind API.
7. Log disimpan di MongoDB.
8. Error log masuk queue.
9. Worker membuat fingerprint.
10. Incident dibuat otomatis jika error berulang.
11. AI membuat summary incident.
12. Frontend dashboard menampilkan semua log dan incident secara terpusat.
```

---

# 18. Development Roadmap

## Phase 1 — NestJS Backend Foundation

Target:

* Setup NestJS API.
* Setup PostgreSQL + Prisma.
* Setup MongoDB + Mongoose.
* Setup Redis + BullMQ.
* Setup Docker Compose.
* Setup Swagger.
* Setup global exception filter.
* Setup config module.
* Setup auth.

Deliverables:

* API running.
* Database connected.
* Auth working.
* Docker Compose working.
* Swagger available.

---

## Phase 2 — Project, API Key, and Service Registry

Target:

* Project management.
* Server API key.
* Client API key.
* API key hashing.
* API key guard.
* Service auto-registration.

Deliverables:

* User bisa membuat project.
* User bisa membuat API key.
* Logs dapat dikaitkan ke project dan service.
* API key validation berjalan.

---

## Phase 3 — Central Log Ingestion

Target:

* `/logs/ingest`
* `/logs/frontend`
* Raw log storage.
* Log query/filter.
* Pagination.
* Queue error/fatal logs.

Deliverables:

* Docker/API/frontend logs bisa masuk.
* Semua log tersimpan di MongoDB.
* User bisa search dan filter logs.
* Error logs masuk Redis queue.

---

## Phase 4 — NestJS Worker and Incident Detection

Target:

* Worker consume queue.
* Fingerprint error.
* Detect repeated error.
* Create/update incident.
* Incident query API.

Deliverables:

* Error berulang membuat incident otomatis.
* Incident detail bisa dilihat.
* Incident logs bisa ditampilkan.
* Worker berjalan terpisah dari API.

---

## Phase 5 — API Logger Middleware

Target:

* Middleware untuk backend Express.
* Capture request/response.
* Mask sensitive fields.
* Send log to LogMind API.

Deliverables:

* Demo backend service mengirim API response logs.
* Status code 4xx/5xx masuk sebagai warn/error.
* Slow response tercatat.

---

## Phase 6 — Docker Agent

Target:

* Agent membaca Docker logs.
* Filter container dengan label.
* Kirim logs ke LogMind API.
* Retry sederhana.

Deliverables:

* Demo Docker services otomatis terpantau.
* Container logs muncul di dashboard.
* Metadata container tersimpan.

---

## Phase 7 — Frontend SDK

Target:

* Capture browser error.
* Capture unhandled promise rejection.
* Capture failed API request.
* Send frontend logs to `/logs/frontend`.

Deliverables:

* JavaScript error masuk dashboard.
* Failed API request frontend terlihat.
* Frontend error dapat dikaitkan dengan backend request jika ada request ID.

---

## Phase 8 — AI Summary and Dashboard

Target:

* AI summary untuk incident.
* Dashboard summary API.
* API performance summary.
* Frontend error summary.

Deliverables:

* AI summary tersedia.
* Dashboard menampilkan data terpusat.
* Project siap demo sebagai portfolio.

---

# 19. Success Metrics

Untuk portfolio, success metrics utama:

1. Log dari minimal 3 Docker container berhasil dikumpulkan.
2. API response log dari minimal 2 backend service berhasil dikumpulkan.
3. Frontend error log dari minimal 1 frontend app berhasil dikumpulkan.
4. Semua log tampil dalam satu dashboard API.
5. Error berulang otomatis membuat incident.
6. AI summary berhasil dibuat untuk incident.
7. `docker compose up` menjalankan semua demo services.
8. README menjelaskan arsitektur, trade-off, dan cara demo.
9. NestJS backend memiliki module architecture yang rapi.
10. Worker berjalan terpisah dari API.
11. Middleware Express dapat digunakan oleh demo service lain.

---

# 20. Risks and Mitigation

## Risk 1 — Scope terlalu besar

Mitigation:

* Fokus MVP hanya pada Docker logs, API response logs, frontend errors, incident detection, dan AI summary.
* Jangan membangun metrics dan tracing lengkap.
* Jangan langsung membuat SaaS production.

---

## Risk 2 — NestJS architecture terlalu kompleks

Mitigation:

* Jangan membuat abstraction berlebihan di awal.
* Gunakan module sesuai kebutuhan domain.
* Repository layer dibuat hanya jika query mulai kompleks.
* Fokus fitur jalan dulu, lalu refactor.

---

## Risk 3 — Docker socket security

Mitigation:

* Jelaskan bahwa Docker socket mount hanya untuk local demo.
* Gunakan label filtering.
* Jangan expose API ke publik tanpa konfigurasi security.
* Jangan collect container tanpa label.

---

## Risk 4 — Data sensitif terkirim

Mitigation:

* Mask field seperti password, token, authorization, dan cookie.
* Batasi request/response body logging.
* Sediakan config `ignoredFields`.
* Jangan simpan full body by default.

---

## Risk 5 — Log terlalu banyak

Mitigation:

* Pagination.
* Rate limit per API key.
* Log retention sederhana.
* Batasi jumlah log demo.
* Queue hanya untuk error/fatal/warn tertentu.

---

## Risk 6 — AI summary tidak akurat

Mitigation:

* AI output diberi label sebagai suggestion.
* Gunakan structured output.
* Simpan sample logs agar user bisa verifikasi manual.
* Jangan jadikan AI sebagai satu-satunya sumber diagnosis.

---

# 21. Portfolio Value

Project ini bernilai tinggi untuk portfolio Backend Engineer karena menunjukkan:

```txt
NestJS architecture
TypeScript backend
Docker integration
Centralized logging
API response monitoring
Frontend error tracking
Multi-source ingestion
Queue processing
Worker architecture
MongoDB for flexible logs
PostgreSQL for relational incident data
Redis for async processing
AI-assisted incident summary
Dashboard API design
Security via API key and JWT
Guards, interceptors, pipes, filters
SDK and middleware design
```

Yang membedakan project ini dari CRUD biasa:

```txt
CRUD App:
Request → Controller → Database

LogMind AI:
Docker/API/Frontend logs
→ NestJS Ingestion API
→ MongoDB
→ Redis Queue
→ NestJS Worker
→ Fingerprint
→ Incident Detection
→ AI Summary
→ Dashboard API
```

Project ini menunjukkan kemampuan backend engineering yang lebih nyata dibanding aplikasi CRUD sederhana.

---

# 22. Final MVP Definition

MVP dianggap selesai jika:

1. User bisa register dan login.
2. User bisa membuat project.
3. User bisa membuat server API key dan client API key.
4. NestJS ingestion API bisa menerima multi-source logs.
5. Docker Agent bisa menangkap log dari container berlabel.
6. API middleware Express bisa menangkap response API dari demo backend service.
7. Frontend SDK bisa menangkap frontend error.
8. Semua log tersimpan di MongoDB.
9. Service registry otomatis dibuat.
10. Error log masuk Redis queue.
11. NestJS Worker membuat fingerprint.
12. Incident otomatis dibuat dari error berulang.
13. AI summary bisa dibuat untuk incident.
14. Dashboard API menampilkan ringkasan terpusat.
15. Docker Compose menjalankan semua komponen.
16. README menjelaskan cara menjalankan demo dan trade-off arsitektur.

---

# 23. Final Product Statement

**LogMind AI** adalah platform observability sederhana berbasis **NestJS** untuk aplikasi berbasis Docker yang mengumpulkan log container, response API, dan error frontend dari berbagai aplikasi secara terpusat.

Sistem ini membantu developer melihat error lintas service, mendeteksi incident otomatis, dan memahami masalah lebih cepat melalui AI-generated incident summary.

MVP flow:

```txt
Docker logs
API response logs
Frontend error logs
        ↓
NestJS Central Ingestion API
        ↓
MongoDB raw logs
        ↓
Redis queue
        ↓
NestJS Worker analysis
        ↓
PostgreSQL incidents
        ↓
AI summary
        ↓
Next.js dashboard
```

LogMind AI bukan replacement untuk Datadog, Sentry, atau Grafana. LogMind AI adalah developer-first observability tool untuk Docker Compose, local development, internal debugging, dan portfolio backend engineering.
