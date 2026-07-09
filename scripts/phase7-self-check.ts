import { strict as assert } from 'assert';
import {
  buildLogPayload,
  levelForStatus,
  logmindApiLogger,
  maskSensitiveData,
} from '../packages/api-logger-express/src';

async function main() {
  assert.equal(levelForStatus(200), 'info');
  assert.equal(levelForStatus(404), 'warn');
  assert.equal(levelForStatus(500), 'error');
  assert.deepEqual(
    maskSensitiveData({
      password: 'secret',
      nested: { authorization: 'Bearer token', ok: true },
      items: [{ cookie: 'session' }],
    }),
    {
      password: '[masked]',
      nested: { authorization: '[masked]', ok: true },
      items: [{ cookie: '[masked]' }],
    },
  );

  const startedAt = Date.now() - 42;
  const payload = buildLogPayload(
    {
      apiKey: 'key',
      serviceName: 'auth-service',
      environment: 'development',
      endpoint: 'http://logmind/logs/ingest',
      captureRequestBody: true,
    },
    {
      method: 'POST',
      originalUrl: '/login',
      headers: {
        'x-request-id': 'req_1',
        'user-agent': 'node-test',
        'x-forwarded-for': '10.0.0.1, 10.0.0.2',
      },
      body: { email: 'a@example.com', password: 'secret' },
    },
    {
      statusCode: 500,
      locals: { errorMessage: 'Database timeout' },
      on: () => undefined,
    },
    startedAt,
  );

  assert.equal(payload.level, 'error');
  assert.equal(payload.requestId, 'req_1');
  assert.equal(payload.api.ip, '10.0.0.1');
  assert.equal(payload.api.userAgent, 'node-test');
  assert.equal(payload.api.errorMessage, 'Database timeout');
  assert.deepEqual(payload.metadata, {
    requestBody: { email: 'a@example.com', password: '[masked]' },
  });

  let nextCalled = false;
  let finish: (() => void) | undefined;
  const middleware = logmindApiLogger({
    apiKey: 'key',
    serviceName: 'auth-service',
    environment: 'development',
    endpoint: 'http://logmind/logs/ingest',
    fetchImpl: async () => {
      throw new Error('network down');
    },
  });

  middleware(
    { method: 'GET', url: '/health', headers: {} },
    {
      statusCode: 200,
      on: (_event, listener) => {
        finish = listener;
      },
    },
    () => {
      nextCalled = true;
    },
  );
  finish?.();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(nextCalled, true);
  console.log('phase7 self-check passed');
}

void main();
