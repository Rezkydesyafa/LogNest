import { strict as assert } from 'assert';
import {
  browserMetadata,
  initLogMindFrontend,
  maskSensitiveData,
  sendFrontendLog,
  setupFetchInstrumentation,
} from '../packages/frontend-logger/src';

async function main() {
  assert.deepEqual(
    maskSensitiveData({ password: 'secret', nested: { token: 'abc', ok: true } }),
    { password: '[masked]', nested: { token: '[masked]', ok: true } },
  );

  const metadata = browserMetadata({
    location: { href: 'https://app.test/dashboard', pathname: '/dashboard' },
    navigator: { userAgent: 'test-agent', language: 'id-ID' },
    innerWidth: 1280,
    innerHeight: 720,
  } as unknown as Window);

  assert.equal(metadata.pageUrl, 'https://app.test/dashboard');
  assert.equal(metadata.route, '/dashboard');
  assert.deepEqual(metadata.viewport, { width: 1280, height: 720 });

  await sendFrontendLog(
    {
      apiKey: 'client-key',
      serviceName: 'frontend-dashboard',
      environment: 'development',
      endpoint: 'http://logmind/logs/frontend',
      fetchImpl: async () => {
        throw new Error('network down');
      },
    },
    {
      serviceName: 'frontend-dashboard',
      environment: 'development',
      level: 'error',
      message: 'boom',
      timestamp: new Date().toISOString(),
    },
  );

  let sentPayload: Record<string, unknown> | undefined;
  const windowRef = {
    fetch: async () => new Response('nope', { status: 500, statusText: 'Server Error' }),
  } as unknown as Window;
  const restore = setupFetchInstrumentation(windowRef, (payload) => {
    sentPayload = payload as Record<string, unknown>;
  });

  const response = await windowRef.fetch('/api/orders');
  restore();

  assert.equal(response.status, 500);
  assert.equal(sentPayload?.level, 'error');
  assert.equal((sentPayload?.api as Record<string, unknown>).statusCode, 500);

  let nextPayload: Record<string, unknown> | undefined;
  const client = initLogMindFrontend({
    apiKey: 'client-key',
    serviceName: 'frontend-dashboard',
    environment: 'development',
    endpoint: 'http://logmind/logs/frontend',
    captureGlobalErrors: false,
    instrumentFetch: false,
    fetchImpl: async (_url, init) => {
      nextPayload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response('{}', { status: 200 });
    },
    windowRef: {
      location: { href: 'https://app.test/a', pathname: '/a' },
      navigator: { userAgent: 'agent', language: 'en' },
      innerWidth: 100,
      innerHeight: 200,
    } as unknown as Window,
  });

  client.captureMessage('hello', 'info', { token: 'secret' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  client.destroy();

  assert.equal(nextPayload?.message, 'hello');
  assert.deepEqual(nextPayload?.metadata, { token: '[masked]' });

  let ingestionCalls = 0;
  const loopSafeClient = initLogMindFrontend({
    apiKey: 'client-key',
    serviceName: 'frontend-dashboard',
    environment: 'development',
    endpoint: 'http://logmind/logs/frontend',
    captureGlobalErrors: false,
    windowRef: {
      fetch: async () => {
        ingestionCalls += 1;
        return new Response('{}', { status: 500 });
      },
    } as unknown as Window,
  });

  loopSafeClient.captureMessage('ingestion failure');
  await new Promise((resolve) => setTimeout(resolve, 0));
  loopSafeClient.destroy();
  assert.equal(ingestionCalls, 1);
  console.log('phase8 self-check passed');
}

void main();
