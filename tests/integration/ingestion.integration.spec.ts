import { NestFactory } from '@nestjs/core';
import { INestApplicationContext } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule as WorkerModule } from '../../apps/worker/src/app.module';
import { createServerKey, randomSuffix, seedUserWithProject, startApi, TestApi, waitFor } from './harness';

let api: TestApi;
let worker: INestApplicationContext;
let apiKey: string;
let accessToken: string;
let projectId: string;

beforeAll(async () => {
  api = await startApi();

  // The real worker, consuming the real queue: this is what makes the test cover the whole
  // pipeline rather than just the ingestion endpoint.
  worker = await NestFactory.createApplicationContext(WorkerModule, { logger: false });
  await worker.init();

  const seed = await seedUserWithProject(api);
  accessToken = seed.accessToken;
  projectId = seed.project.id;
  apiKey = await createServerKey(api, accessToken, projectId);
});

afterAll(async () => {
  await worker?.close();
  await api?.close();
});

function ingest(body: Record<string, unknown>) {
  return api.http().post('/logs/ingest').set('x-api-key', apiKey).send(body);
}

const errorLog = (message: string, overrides: Record<string, unknown> = {}) => ({
  sourceType: 'api',
  serviceName: 'payment-service',
  environment: 'production',
  level: 'error',
  message,
  ...overrides,
});

describe('log ingestion', () => {
  it('rejects a request without a valid API key', async () => {
    await api.http().post('/logs/ingest').send(errorLog('no key')).expect(401);
    await api
      .http()
      .post('/logs/ingest')
      .set('x-api-key', 'lm_server_wrong')
      .send(errorLog('bad key'))
      .expect(401);
  });

  it('stores a log and registers its service on first sight', async () => {
    const response = await ingest(errorLog('checkout failed')).expect(201);

    expect(response.body.data.logId).toBeTruthy();

    const service = await waitFor(
      () =>
        api.prisma.service.findFirst({
          where: { projectId, name: 'payment-service', environment: 'production' },
        }),
      { label: 'service registration' },
    );
    expect(service.sourceTypes).toContain('api');
  });

  it('validates the payload', async () => {
    await ingest({ sourceType: 'api' }).expect(400);
    await ingest(errorLog('x', { level: 'catastrophic' })).expect(400);
    await ingest(errorLog('x', { sourceType: 'frontend' })).expect(400);
  });

  it('redacts secrets out of the message before storing it', async () => {
    const response = await ingest(errorLog('auth failed with password=hunter2 for rezky@example.com')).expect(
      201,
    );

    const stored = await api
      .http()
      .get(`/logs/${response.body.data.logId}`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(stored.body.data.message).not.toContain('hunter2');
    expect(stored.body.data.message).not.toContain('rezky@example.com');
    expect(stored.body.data.message).toContain('[masked]');
  });

  it('accepts a batch through the bulk endpoint', async () => {
    const logs = Array.from({ length: 5 }, (_, index) => errorLog(`bulk failure ${index}`));
    const response = await api
      .http()
      .post('/logs/ingest/bulk')
      .set('x-api-key', apiKey)
      .send({ logs })
      .expect(201);

    expect(response.body.data.accepted).toBe(5);
    expect(response.body.data.queued).toBe(5);
  });

  it('rejects a batch above the cap', async () => {
    await api
      .http()
      .post('/logs/ingest/bulk')
      .set('x-api-key', apiKey)
      .send({ logs: Array.from({ length: 501 }, () => errorLog('too many')) })
      .expect(400);
  });
});

describe('incident detection pipeline', () => {
  it('opens one incident after five matching errors, not five incidents', async () => {
    const marker = randomSuffix();

    // Volatile ids differ on every line; the fingerprinter must normalise them away.
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await ingest(
        errorLog(`Database timeout for order ${attempt * 137} in ${marker}`, {
          api: { path: `/orders/${marker}`, statusCode: 500, method: 'POST' },
        }),
      ).expect(201);
    }

    const incident = await waitFor(
      () => api.prisma.incident.findFirst({ where: { projectId, title: { contains: marker } } }),
      { label: 'incident creation' },
    );

    expect(incident.severity).toBe('HIGH');
    expect(incident.status).toBe('OPEN');
    expect(incident.occurrenceCount).toBeGreaterThanOrEqual(5);

    const all = await api.prisma.incident.findMany({
      where: { projectId, title: { contains: marker } },
    });
    expect(all).toHaveLength(1);
  });

  it('keeps occurrenceCount as a lifetime total that only grows', async () => {
    const marker = randomSuffix();
    const send = () => ingest(errorLog(`Cache miss storm ${marker}`, { api: { path: `/cache/${marker}` } }));

    for (let attempt = 0; attempt < 5; attempt += 1) await send().expect(201);
    const opened = await waitFor(
      () => api.prisma.incident.findFirst({ where: { projectId, title: { contains: marker } } }),
      { label: 'incident creation' },
    );

    for (let attempt = 0; attempt < 3; attempt += 1) await send().expect(201);
    const grown = await waitFor(
      async () => {
        const incident = await api.prisma.incident.findUnique({ where: { id: opened.id } });
        return incident && incident.occurrenceCount > opened.occurrenceCount ? incident : undefined;
      },
      { label: 'occurrence increment' },
    );

    expect(grown.occurrenceCount).toBeGreaterThan(opened.occurrenceCount);
    expect(grown.recentCount).toBeGreaterThanOrEqual(5);
  });

  it('does not open an incident below the threshold', async () => {
    const marker = randomSuffix();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await ingest(errorLog(`Rare hiccup ${marker}`)).expect(201);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const incidents = await api.prisma.incident.findMany({
      where: { projectId, title: { contains: marker } },
    });
    expect(incidents).toHaveLength(0);
  });

  it('never queues an info log', async () => {
    const response = await ingest(errorLog('healthy request', { level: 'info' })).expect(201);

    expect(response.body.data.queued).toBe(false);
  });
});

describe('incident read API', () => {
  it('lists incidents scoped to the caller and exposes their events', async () => {
    const marker = randomSuffix();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await ingest(errorLog(`Listing check ${marker}`)).expect(201);
    }
    await waitFor(
      () => api.prisma.incident.findFirst({ where: { projectId, title: { contains: marker } } }),
      { label: 'incident creation' },
    );

    const response = await api
      .http()
      .get(`/incidents?projectId=${projectId}`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    const found = response.body.data.items.find((item: { title: string }) => item.title.includes(marker));
    expect(found).toBeTruthy();
    expect(found.events.length).toBeGreaterThan(0);
  });

  it('changes incident status and records the transition', async () => {
    const marker = randomSuffix();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await ingest(errorLog(`Resolve check ${marker}`)).expect(201);
    }
    const incident = await waitFor(
      () => api.prisma.incident.findFirst({ where: { projectId, title: { contains: marker } } }),
      { label: 'incident creation' },
    );

    await api
      .http()
      .patch(`/incidents/${incident.id}/status`)
      .set('authorization', `Bearer ${accessToken}`)
      .send({ status: 'RESOLVED' })
      .expect(200);

    const updated = await api.prisma.incident.findUnique({ where: { id: incident.id } });
    expect(updated?.status).toBe('RESOLVED');
    expect(updated?.resolvedAt).toBeTruthy();

    const audit = await api.prisma.auditLog.findFirst({
      where: { projectId, action: 'incident.status_changed', targetId: incident.id },
    });
    expect(audit?.actorEmail).toContain('@example.com');
  });
});
