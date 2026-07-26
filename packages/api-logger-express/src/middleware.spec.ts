import { describe, expect, it, vi } from 'vitest';
import {
  buildLogPayload,
  levelForStatus,
  LogMindApiLoggerOptions,
  LogMindResponse,
  logmindApiLogger,
} from './middleware';

const options: LogMindApiLoggerOptions = {
  apiKey: 'lm_server_x',
  serviceName: 'auth-service',
  environment: 'development',
  endpoint: 'http://logmind/logs/ingest',
};

function responseStub(overrides: Partial<LogMindResponse> = {}): LogMindResponse {
  return { statusCode: 200, on: () => undefined, ...overrides };
}

describe('levelForStatus', () => {
  it.each([
    [200, 'info'],
    [304, 'info'],
    [400, 'warn'],
    [404, 'warn'],
    [499, 'warn'],
    [500, 'error'],
    [503, 'error'],
  ])('maps %i to %s', (status, level) => {
    expect(levelForStatus(status)).toBe(level);
  });
});

describe('buildLogPayload', () => {
  it('captures request metadata and computes the duration', () => {
    const payload = buildLogPayload(
      options,
      {
        method: 'POST',
        originalUrl: '/login',
        headers: { 'x-request-id': 'req_1', 'user-agent': 'node-test' },
      },
      responseStub({ statusCode: 201 }),
      Date.now() - 42,
    );

    expect(payload.sourceType).toBe('api');
    expect(payload.level).toBe('info');
    expect(payload.requestId).toBe('req_1');
    expect(payload.api.method).toBe('POST');
    expect(payload.api.path).toBe('/login');
    expect(payload.api.statusCode).toBe(201);
    expect(payload.api.userAgent).toBe('node-test');
    expect(payload.api.durationMs).toBeGreaterThanOrEqual(42);
    expect(payload.message).toBe('POST /login responded 201');
  });

  it('takes the first x-forwarded-for hop when no direct ip is set', () => {
    const payload = buildLogPayload(
      options,
      { method: 'GET', url: '/health', headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2' } },
      responseStub(),
      Date.now(),
    );

    expect(payload.api.ip).toBe('10.0.0.1');
  });

  it('prefers a direct ip over the forwarded header', () => {
    const payload = buildLogPayload(
      options,
      { method: 'GET', url: '/health', ip: '203.0.113.9', headers: { 'x-forwarded-for': '10.0.0.1' } },
      responseStub(),
      Date.now(),
    );

    expect(payload.api.ip).toBe('203.0.113.9');
  });

  it('promotes an error message from res.locals into the log message', () => {
    const payload = buildLogPayload(
      options,
      { method: 'POST', originalUrl: '/pay', headers: {} },
      responseStub({ statusCode: 500, locals: { errorMessage: 'Database timeout' } }),
      Date.now(),
    );

    expect(payload.level).toBe('error');
    expect(payload.api.errorMessage).toBe('Database timeout');
    expect(payload.message).toBe('POST /pay failed with 500: Database timeout');
  });

  it('reads an Error instance from res.locals.error', () => {
    const payload = buildLogPayload(
      options,
      { method: 'GET', url: '/x', headers: {} },
      responseStub({ statusCode: 500, locals: { error: new Error('boom') } }),
      Date.now(),
    );

    expect(payload.api.errorMessage).toBe('boom');
  });

  it('masks the request body only when capture is enabled', () => {
    const request = {
      method: 'POST',
      originalUrl: '/login',
      headers: {},
      body: { email: 'a@example.com', password: 'secret' },
    };

    expect(buildLogPayload(options, request, responseStub(), Date.now()).metadata).toBeUndefined();
    expect(
      buildLogPayload({ ...options, captureRequestBody: true }, request, responseStub(), Date.now()).metadata,
    ).toEqual({ requestBody: { email: 'a@example.com', password: '[masked]' } });
  });

  it('falls back to the response x-request-id header', () => {
    const payload = buildLogPayload(
      options,
      { method: 'GET', url: '/x', headers: {} },
      responseStub({ getHeader: () => 'req_from_response' }),
      Date.now(),
    );

    expect(payload.requestId).toBe('req_from_response');
  });
});

describe('logmindApiLogger', () => {
  it('always calls next and sends on finish', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const next = vi.fn();
    let finish: (() => void) | undefined;

    logmindApiLogger({ ...options, fetchImpl: fetchImpl as unknown as typeof fetch })(
      { method: 'GET', url: '/health', headers: {} },
      responseStub({ on: (_event, listener) => (finish = listener) }),
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(fetchImpl).not.toHaveBeenCalled();

    finish?.();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce());
    expect(fetchImpl.mock.calls[0][1].headers['x-api-key']).toBe('lm_server_x');
  });

  it('never throws when delivery fails', async () => {
    const next = vi.fn();
    let finish: (() => void) | undefined;

    logmindApiLogger({
      ...options,
      fetchImpl: (async () => {
        throw new Error('network down');
      }) as unknown as typeof fetch,
    })(
      { method: 'GET', url: '/health', headers: {} },
      responseStub({ on: (_event, listener) => (finish = listener) }),
      next,
    );

    expect(() => finish?.()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(next).toHaveBeenCalledOnce();
  });

  it('skips delivery entirely without an api key', () => {
    const fetchImpl = vi.fn();
    let finish: (() => void) | undefined;

    logmindApiLogger({ ...options, apiKey: undefined, fetchImpl: fetchImpl as unknown as typeof fetch })(
      { method: 'GET', url: '/health', headers: {} },
      responseStub({ on: (_event, listener) => (finish = listener) }),
      () => undefined,
    );
    finish?.();

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
