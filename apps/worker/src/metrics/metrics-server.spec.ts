import { AddressInfo } from 'net';
import { Server } from 'http';
import { afterEach, describe, expect, it } from 'vitest';
import { MetricsService } from '../../../../packages/shared/src';
import { startMetricsServer } from './metrics-server';

let server: Server | undefined;

function listen(token?: string) {
  const metrics = new MetricsService();
  server = startMetricsServer(metrics, { port: 0, token });

  return new Promise<string>((resolve) => {
    server!.on('listening', () => {
      const { port } = server!.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

afterEach(() => {
  server?.close();
  server = undefined;
});

describe('startMetricsServer', () => {
  it('serves metrics in the Prometheus format', async () => {
    const base = await listen();
    const response = await fetch(`${base}/metrics`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(await response.text()).toContain('logmind_queue_depth');
  });

  it('answers a health probe', async () => {
    const base = await listen();
    const response = await fetch(`${base}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('404s on any other path', async () => {
    const base = await listen();

    expect((await fetch(`${base}/anything`)).status).toBe(404);
  });

  it('requires the token when one is configured', async () => {
    const base = await listen('scrape-secret');

    expect((await fetch(`${base}/metrics`)).status).toBe(403);
    expect((await fetch(`${base}/metrics`, { headers: { authorization: 'Bearer wrong' } })).status).toBe(403);
    expect(
      (await fetch(`${base}/metrics`, { headers: { authorization: 'Bearer scrape-secret' } })).status,
    ).toBe(200);
  });

  it('leaves the health probe unauthenticated so orchestrators can use it', async () => {
    const base = await listen('scrape-secret');

    expect((await fetch(`${base}/health`)).status).toBe(200);
  });
});
