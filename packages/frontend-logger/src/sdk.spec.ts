import { describe, expect, it, vi } from 'vitest';
import { setupFetchInstrumentation } from './fetch-instrumentation';
import { browserMetadata, initLogMindFrontend, normalizeError, sendFrontendLog } from './sdk';

const options = {
  apiKey: 'lm_client_x',
  serviceName: 'frontend-dashboard',
  environment: 'development',
  endpoint: 'http://logmind/logs/frontend',
};

const fakeWindow = (overrides: Record<string, unknown> = {}) =>
  ({
    location: { href: 'https://app.test/dashboard', pathname: '/dashboard' },
    navigator: { userAgent: 'test-agent', language: 'id-ID' },
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    ...overrides,
  }) as unknown as Window;

describe('browserMetadata', () => {
  it('collects page, route, agent, and viewport', () => {
    expect(browserMetadata(fakeWindow())).toEqual({
      pageUrl: 'https://app.test/dashboard',
      route: '/dashboard',
      userAgent: 'test-agent',
      language: 'id-ID',
      viewport: { width: 1280, height: 720 },
    });
  });

  it('returns an empty object outside a browser', () => {
    expect(browserMetadata(undefined)).toEqual({});
  });
});

describe('normalizeError', () => {
  it('extracts message and stack from an Error', () => {
    const normalized = normalizeError(new Error('boom'));

    expect(normalized.message).toBe('boom');
    expect(normalized.stack).toContain('boom');
  });

  it('falls back to the error name for an empty message', () => {
    expect(normalizeError(new TypeError()).message).toBe('TypeError');
  });

  it('accepts a plain string and unknown values', () => {
    expect(normalizeError('string failure').message).toBe('string failure');
    expect(normalizeError({ weird: true }).message).toBe('Unknown frontend error');
  });
});

describe('sendFrontendLog', () => {
  const payload = {
    serviceName: 'frontend-dashboard',
    environment: 'development',
    level: 'error' as const,
    message: 'boom',
    timestamp: '2026-07-26T10:00:00.000Z',
  };

  it('never rejects when the network is down', async () => {
    await expect(
      sendFrontendLog(
        {
          ...options,
          fetchImpl: (async () => {
            throw new Error('network down');
          }) as unknown as typeof fetch,
        },
        payload,
      ),
    ).resolves.toBeUndefined();
  });

  it('does nothing without an api key', async () => {
    const fetchImpl = vi.fn();

    await sendFrontendLog({ ...options, apiKey: undefined, fetchImpl: fetchImpl as never }, payload);

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('setupFetchInstrumentation', () => {
  it('reports failed responses and restores the original fetch', async () => {
    const send = vi.fn();
    const windowRef = fakeWindow({
      fetch: async () => new Response('nope', { status: 500, statusText: 'Server Error' }),
    });
    const restore = setupFetchInstrumentation(windowRef, send);
    const response = await windowRef.fetch('/api/orders');
    restore();

    expect(response.status).toBe(500);
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0]).toMatchObject({
      level: 'error',
      api: { statusCode: 500, path: '/api/orders', errorMessage: 'Server Error' },
    });
    expect(await (await windowRef.fetch('/api/orders')).text()).toBe('nope');
    expect(send).toHaveBeenCalledOnce();
  });

  it('downgrades 4xx responses to warn', async () => {
    const send = vi.fn();
    const windowRef = fakeWindow({ fetch: async () => new Response('', { status: 404 }) });
    setupFetchInstrumentation(windowRef, send);

    await windowRef.fetch('/api/missing');

    expect(send.mock.calls[0][0].level).toBe('warn');
  });

  it('ignores successful responses', async () => {
    const send = vi.fn();
    const windowRef = fakeWindow({ fetch: async () => new Response('{}', { status: 200 }) });
    setupFetchInstrumentation(windowRef, send);

    await windowRef.fetch('/api/ok');

    expect(send).not.toHaveBeenCalled();
  });

  it('reports and rethrows network failures', async () => {
    const send = vi.fn();
    const windowRef = fakeWindow({
      fetch: async () => {
        throw new Error('offline');
      },
    });
    setupFetchInstrumentation(windowRef, send);

    await expect(windowRef.fetch('/api/orders')).rejects.toThrow('offline');
    expect(send.mock.calls[0][0].api.errorMessage).toBe('offline');
  });
});

describe('initLogMindFrontend', () => {
  it('masks metadata before sending a captured message', async () => {
    let body: Record<string, unknown> | undefined;
    const client = initLogMindFrontend({
      ...options,
      captureGlobalErrors: false,
      instrumentFetch: false,
      windowRef: fakeWindow(),
      fetchImpl: (async (_url: string, init: RequestInit) => {
        body = JSON.parse(String(init.body));
        return new Response('{}', { status: 200 });
      }) as unknown as typeof fetch,
    });

    client.captureMessage('hello', 'info', { token: 'secret', keep: 'me' });
    await vi.waitFor(() => expect(body).toBeDefined());
    client.destroy();

    expect(body).toMatchObject({
      message: 'hello',
      level: 'info',
      metadata: { token: '[masked]', keep: 'me' },
      frontend: { route: '/dashboard' },
    });
  });

  it('captures an error with its stack trace', async () => {
    let body: Record<string, unknown> | undefined;
    const client = initLogMindFrontend({
      ...options,
      captureGlobalErrors: false,
      instrumentFetch: false,
      windowRef: fakeWindow(),
      fetchImpl: (async (_url: string, init: RequestInit) => {
        body = JSON.parse(String(init.body));
        return new Response('{}', { status: 200 });
      }) as unknown as typeof fetch,
    });

    client.captureError(new Error('render failed'));
    await vi.waitFor(() => expect(body).toBeDefined());
    client.destroy();

    expect(body).toMatchObject({ level: 'error', message: 'render failed' });
    expect(String(body!.stackTrace)).toContain('render failed');
  });

  it('does not loop when its own ingestion request fails', async () => {
    let ingestionCalls = 0;
    const client = initLogMindFrontend({
      ...options,
      captureGlobalErrors: false,
      windowRef: fakeWindow({
        fetch: async () => {
          ingestionCalls += 1;
          return new Response('{}', { status: 500 });
        },
      }),
    });

    client.captureMessage('ingestion failure');
    await new Promise((resolve) => setTimeout(resolve, 10));
    client.destroy();

    expect(ingestionCalls).toBe(1);
  });
});
