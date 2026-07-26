import { describe, expect, it, vi } from 'vitest';
import { DockerLogPayload, LogMindClient } from './logmind-client';

const payload: DockerLogPayload = {
  sourceType: 'docker',
  serviceName: 'payment-service',
  environment: 'development',
  level: 'error',
  message: 'boom',
  timestamp: '2026-07-26T10:00:00.000Z',
  metadata: {},
};

const config = {
  apiKey: 'lm_server_x',
  endpoint: 'http://api/logs/ingest',
  bulkEndpoint: 'http://api/logs/ingest/bulk',
  retryAttempts: 3,
  retryDelayMs: 1,
};

const clientWith = (fetchImpl: unknown, overrides: Partial<typeof config> = {}) =>
  new LogMindClient({ ...config, ...overrides }, fetchImpl as typeof fetch);

describe('LogMindClient.send', () => {
  it('does nothing without an API key', async () => {
    const fetchImpl = vi.fn();

    await expect(clientWith(fetchImpl, { apiKey: '' }).send(payload)).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends the payload with the api key header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });

    await expect(clientWith(fetchImpl).send(payload)).resolves.toBe(true);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://api/logs/ingest');
    expect(init.method).toBe('POST');
    expect(init.headers['x-api-key']).toBe('lm_server_x');
    expect(JSON.parse(init.body)).toEqual(payload);
  });

  it('retries a rejected request and succeeds on a later attempt', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true });

    await expect(clientWith(fetchImpl).send(payload)).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('retries a 429 because the server asked it to back off', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({ ok: true });

    await expect(clientWith(fetchImpl).send(payload)).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('gives up immediately on a rejected payload instead of retrying', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 400 });

    await expect(clientWith(fetchImpl).send(payload)).resolves.toBe(false);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('gives up after the configured attempts without throwing', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('down'));

    await expect(clientWith(fetchImpl, { retryAttempts: 2 }).send(payload)).resolves.toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('LogMindClient.sendBatch', () => {
  it('accepts an empty batch without calling the API', async () => {
    const fetchImpl = vi.fn();

    await expect(clientWith(fetchImpl).sendBatch([])).resolves.toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('uses the single endpoint for a batch of one', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });

    await clientWith(fetchImpl).sendBatch([payload]);

    expect(fetchImpl.mock.calls[0][0]).toBe('http://api/logs/ingest');
  });

  it('posts a real batch to the bulk endpoint in one request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });

    await expect(clientWith(fetchImpl).sendBatch([payload, payload, payload])).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://api/logs/ingest/bulk');
    expect(JSON.parse(init.body).logs).toHaveLength(3);
  });

  it('falls back to single sends when the bulk route is missing', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('/bulk')) return { ok: false, status: 404 };
      return { ok: true };
    });

    await expect(clientWith(fetchImpl).sendBatch([payload, payload])).resolves.toBe(true);
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'http://api/logs/ingest/bulk',
      'http://api/logs/ingest',
      'http://api/logs/ingest',
    ]);
  });
});
