import { AddressInfo } from 'net';
import { Server } from 'http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDemoApp } from './app';
import { DemoConfig, loadDemoConfig } from './config';
import { TrafficGenerator } from './traffic';

let server: Server | undefined;

function start(overrides: Partial<DemoConfig> = {}) {
  const config: DemoConfig = { ...loadDemoConfig({}), logmindApiKey: '', ...overrides };

  return new Promise<{ base: string; config: DemoConfig }>((resolve) => {
    server = createDemoApp(config).listen(0, () => {
      const { port } = server!.address() as AddressInfo;
      resolve({ base: `http://127.0.0.1:${port}`, config: { ...config, port } });
    });
  });
}

afterEach(() => {
  server?.close();
  server = undefined;
});

describe('createDemoApp', () => {
  it('answers a health probe', async () => {
    const { base } = await start();
    const response = await fetch(`${base}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok', service: 'demo-auth-service' });
  });

  it('succeeds on demand regardless of the error rate', async () => {
    const { base } = await start({ errorRate: 1 });
    const response = await fetch(`${base}/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-demo-outcome': 'ok' },
      body: JSON.stringify({ email: 'a@b.c', password: 'x' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
  });

  it('fails on demand with the scenario status and message', async () => {
    const { base } = await start({ errorRate: 0 });
    const response = await fetch(`${base}/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-demo-outcome': 'fail' },
      body: JSON.stringify({ email: 'a@b.c', password: 'x' }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Invalid credentials for demo login' });
  });

  it('turns a 5xx scenario into a thrown error so a stack trace is produced', async () => {
    const { base } = await start({ errorRate: 0 });
    const response = await fetch(`${base}/session`, { headers: { 'x-demo-outcome': 'fail' } });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Session store connection timeout' });
  });

  it('serves the routes of the selected service only', async () => {
    const { base } = await start({ service: 'payment', serviceName: 'demo-payment-service' });

    expect((await fetch(`${base}/balance`, { headers: { 'x-demo-outcome': 'ok' } })).status).toBe(200);
    expect((await fetch(`${base}/login`, { method: 'POST' })).status).toBe(404);
  });

  it('forwards the request to LogMind with the request body masked', async () => {
    const sent: Record<string, unknown>[] = [];
    const { base } = await start({
      errorRate: 0,
      logmindApiKey: 'lm_server_x',
      logmindEndpoint: 'http://logmind.test/logs/ingest',
    });

    // The middleware uses global fetch; intercept it for the assertion.
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      if (String(url).includes('logmind.test')) {
        sent.push(JSON.parse(String(init.body)));
        return new Response('{}', { status: 200 });
      }
      return original(url as never, init);
    }) as typeof fetch;

    try {
      await original(`${base}/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-demo-outcome': 'ok' },
        body: JSON.stringify({ email: 'a@b.c', password: 'hunter2' }),
      });
      await vi.waitFor(() => expect(sent.length).toBeGreaterThan(0));
    } finally {
      globalThis.fetch = original;
    }

    expect(sent[0]).toMatchObject({
      sourceType: 'api',
      serviceName: 'demo-auth-service',
      metadata: { requestBody: { email: 'a@b.c', password: '[masked]' } },
    });
  });
});

describe('TrafficGenerator', () => {
  it('drives the service over HTTP so the middleware sees a real request', async () => {
    const { config } = await start({ errorRate: 0 });
    const traffic = new TrafficGenerator(config, { random: () => 0, log: () => undefined });

    await expect(traffic.tick()).resolves.toBe(200);
  });

  it('produces the failure path when the roll lands inside the error rate', async () => {
    const { config } = await start({ errorRate: 1 });
    const traffic = new TrafficGenerator(config, { random: () => 0, log: () => undefined });

    await expect(traffic.tick()).resolves.toBe(401);
  });

  it('reports zero instead of throwing when the service is unreachable', async () => {
    const config = { ...loadDemoConfig({}), port: 1 };
    const traffic = new TrafficGenerator(config, { random: () => 0, log: () => undefined });

    await expect(traffic.tick()).resolves.toBe(0);
  });

  it('does not start a timer when traffic is disabled', () => {
    const traffic = new TrafficGenerator(
      { ...loadDemoConfig({}), trafficEnabled: false },
      { log: () => undefined },
    );

    expect(() => traffic.start()).not.toThrow();
    traffic.stop();
  });
});
