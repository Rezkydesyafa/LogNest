import { describe, expect, it, vi } from 'vitest';
import {
  createRateLimit,
  MemoryRateLimitStore,
  RateLimitStore,
  rateLimitSubject,
  RedisRateLimitStore,
} from './rate-limit.middleware';

function responseSpy() {
  const headers: Record<string, string | number> = {};
  let statusCode = 0;
  let body: unknown;
  const response = {
    setHeader: (name: string, value: string | number) => {
      headers[name] = value;
    },
    status: (code: number) => {
      statusCode = code;
      return { json: (payload: unknown) => (body = payload) };
    },
  };

  return {
    response,
    headers,
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
  };
}

const request = (overrides: Record<string, unknown> = {}) => ({
  ip: '203.0.113.1',
  socket: { remoteAddress: '203.0.113.1' },
  headers: {},
  ...overrides,
});

async function run(middleware: ReturnType<typeof createRateLimit>, req: ReturnType<typeof request>) {
  const spy = responseSpy();
  const next = vi.fn();

  middleware(req, spy.response, next);
  await vi.waitFor(() => expect(next.mock.calls.length + (spy.statusCode ? 1 : 0)).toBe(1));

  return { ...spy, next };
}

describe('rateLimitSubject', () => {
  it('prefers the api key so tenants behind one NAT are metered separately', () => {
    const subject = rateLimitSubject(request({ headers: { 'x-api-key': 'lm_server_abcdefghijklmnop' } }));

    expect(subject).toMatch(/^key:[0-9a-f]{32}$/);
    expect(subject).not.toContain('lm_server_');
  });

  it('is stable for the same key and distinct for different keys', () => {
    const a = rateLimitSubject(request({ headers: { 'x-api-key': 'key-a' } }));
    const b = rateLimitSubject(request({ headers: { 'x-api-key': 'key-b' } }));

    expect(rateLimitSubject(request({ headers: { 'x-api-key': 'key-a' } }))).toBe(a);
    expect(a).not.toBe(b);
  });

  it('accepts a repeated header by taking the first value', () => {
    expect(rateLimitSubject(request({ headers: { 'x-api-key': ['first', 'second'] } }))).toBe(
      rateLimitSubject(request({ headers: { 'x-api-key': 'first' } })),
    );
  });

  it('falls back to the ip, then the socket, then unknown', () => {
    expect(rateLimitSubject(request())).toBe('ip:203.0.113.1');
    expect(rateLimitSubject({ socket: { remoteAddress: '10.0.0.1' } })).toBe('ip:10.0.0.1');
    expect(rateLimitSubject({})).toBe('ip:unknown');
  });
});

describe('MemoryRateLimitStore', () => {
  it('counts up within the window and reports the remaining time', async () => {
    const store = new MemoryRateLimitStore();

    expect((await store.consume('a', 60_000)).count).toBe(1);
    expect((await store.consume('a', 60_000)).count).toBe(2);
    expect((await store.consume('b', 60_000)).count).toBe(1);
    expect((await store.consume('a', 60_000)).resetInMs).toBeLessThanOrEqual(60_000);
  });

  it('starts a fresh window once the previous one expired', async () => {
    const store = new MemoryRateLimitStore();

    await store.consume('a', 1);
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect((await store.consume('a', 1)).count).toBe(1);
  });
});

describe('createRateLimit', () => {
  it('lets requests through up to the limit', async () => {
    const middleware = createRateLimit({ name: 'test', windowMs: 60_000, max: 2 });

    expect((await run(middleware, request())).next).toHaveBeenCalledOnce();
    expect((await run(middleware, request())).next).toHaveBeenCalledOnce();
  });

  it('replies 429 with retry-after once the limit is exceeded', async () => {
    const middleware = createRateLimit({ name: 'test', windowMs: 60_000, max: 1 });
    await run(middleware, request());

    const blocked = await run(middleware, request());

    expect(blocked.statusCode).toBe(429);
    expect(blocked.next).not.toHaveBeenCalled();
    expect(blocked.body).toEqual({ message: 'Too many requests' });
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('exposes the standard ratelimit headers', async () => {
    const middleware = createRateLimit({ name: 'test', windowMs: 60_000, max: 5 });
    const { headers } = await run(middleware, request());

    expect(headers['ratelimit-limit']).toBe(5);
    expect(headers['ratelimit-remaining']).toBe(4);
    expect(Number(headers['ratelimit-reset'])).toBeGreaterThan(0);
  });

  it('meters two api keys independently', async () => {
    const middleware = createRateLimit({ name: 'test', windowMs: 60_000, max: 1 });
    const first = request({ headers: { 'x-api-key': 'key-a' } });
    const second = request({ headers: { 'x-api-key': 'key-b' } });

    await run(middleware, first);

    expect((await run(middleware, second)).next).toHaveBeenCalledOnce();
    expect((await run(middleware, first)).statusCode).toBe(429);
  });

  it('falls back to the local counter when the shared store throws', async () => {
    const store: RateLimitStore = {
      consume: async () => {
        throw new Error('redis down');
      },
    };
    const middleware = createRateLimit({ name: 'test', windowMs: 60_000, max: 1, store });

    expect((await run(middleware, request())).next).toHaveBeenCalledOnce();
    expect((await run(middleware, request())).statusCode).toBe(429);
  });

  it('falls back when the shared store returns nothing', async () => {
    const store: RateLimitStore = { consume: async () => undefined };
    const middleware = createRateLimit({ name: 'test', windowMs: 60_000, max: 1, store });

    await run(middleware, request());

    expect((await run(middleware, request())).statusCode).toBe(429);
  });

  it('uses the shared store when it is healthy', async () => {
    const consume = vi.fn().mockResolvedValue({ count: 9, resetInMs: 30_000 });
    const middleware = createRateLimit({
      name: 'test',
      windowMs: 60_000,
      max: 5,
      store: { consume },
    });
    const { statusCode } = await run(middleware, request());

    expect(statusCode).toBe(429);
    expect(consume).toHaveBeenCalledWith('ratelimit:test:ip:203.0.113.1', 60_000, 1);
  });
});

describe('createRateLimit cost', () => {
  it('charges a bulk batch one unit per log it carries', async () => {
    const consume = vi.fn().mockResolvedValue({ count: 200, resetInMs: 30_000 });
    const middleware = createRateLimit({
      name: 'ingest',
      windowMs: 60_000,
      max: 300,
      store: { consume },
      cost: (request) => (request.body as { logs?: unknown[] })?.logs?.length ?? 1,
    });

    await run(middleware, request({ body: { logs: new Array(200).fill({}) } }));

    expect(consume).toHaveBeenCalledWith(expect.any(String), 60_000, 200);
  });

  it('never charges less than one unit', async () => {
    const consume = vi.fn().mockResolvedValue({ count: 1, resetInMs: 1000 });
    const middleware = createRateLimit({
      name: 'ingest',
      windowMs: 60_000,
      max: 300,
      store: { consume },
      cost: () => 0,
    });

    await run(middleware, request());

    expect(consume).toHaveBeenCalledWith(expect.any(String), 60_000, 1);
  });
});

describe('createRateLimit skip', () => {
  it('lets a skipped route through without touching the store', async () => {
    const consume = vi.fn();
    const middleware = createRateLimit({
      name: 'read',
      windowMs: 60_000,
      max: 1,
      store: { consume },
      skip: (req) => (req.path ?? '').startsWith('/ingest'),
    });
    const { next } = await run(middleware, request({ path: '/ingest' }));

    expect(next).toHaveBeenCalledOnce();
    expect(consume).not.toHaveBeenCalled();
  });
});

describe('RedisRateLimitStore', () => {
  it('delegates to the shared fixed window counter', async () => {
    const consumeFixedWindow = vi.fn().mockResolvedValue({ count: 3, resetInMs: 1000 });

    await expect(new RedisRateLimitStore({ consumeFixedWindow }).consume('k', 60_000)).resolves.toEqual({
      count: 3,
      resetInMs: 1000,
    });
    expect(consumeFixedWindow).toHaveBeenCalledWith('k', 60_000, 1);
  });
});
