import { createHash } from 'crypto';

export type RateLimitDecision = { count: number; resetInMs: number };

export type RateLimitStore = {
  consume(key: string, windowMs: number, cost?: number): Promise<RateLimitDecision | undefined>;
};

export type RateLimitOptions = {
  name: string;
  windowMs: number;
  max: number;
  store?: RateLimitStore;
  /** Requests this limiter should ignore, e.g. an ingest route nested under a read mount. */
  skip?: (request: RequestLike) => boolean;
  /** How many units one request consumes. A bulk batch costs one unit per log it carries. */
  cost?: (request: RequestLike) => number;
};

export type RequestLike = {
  ip?: string;
  socket?: { remoteAddress?: string };
  headers?: Record<string, string | string[] | undefined>;
  path?: string;
  url?: string;
  body?: unknown;
};
type ResponseLike = {
  setHeader(name: string, value: string | number): void;
  status(code: number): { json(body: unknown): void };
};
type NextFunction = () => void;

/**
 * Per-process counter. Correct for a single instance, and used as the fallback whenever the
 * shared store is unavailable so a Redis outage degrades the limit instead of removing it.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  private nextCleanupAt = 0;

  async consume(key: string, windowMs: number, cost = 1): Promise<RateLimitDecision> {
    const now = Date.now();

    if (now >= this.nextCleanupAt) {
      for (const [bucketKey, bucket] of this.buckets) {
        if (bucket.resetAt <= now) this.buckets.delete(bucketKey);
      }
      this.nextCleanupAt = now + windowMs;
    }

    const current = this.buckets.get(key);
    const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };

    bucket.count += cost;
    this.buckets.set(key, bucket);

    return { count: bucket.count, resetInMs: bucket.resetAt - now };
  }
}

/**
 * Shared counter backed by Redis, so the limit holds across every API replica instead of
 * being multiplied by the number of processes.
 */
export class RedisRateLimitStore implements RateLimitStore {
  constructor(
    private readonly redis: {
      consumeFixedWindow(
        key: string,
        windowMs: number,
        cost?: number,
      ): Promise<RateLimitDecision | undefined>;
    },
  ) {}

  async consume(key: string, windowMs: number, cost = 1) {
    return this.redis.consumeFixedWindow(key, windowMs, cost);
  }
}

export function createRateLimit(options: RateLimitOptions) {
  const fallback = new MemoryRateLimitStore();
  const store = options.store ?? fallback;

  return (request: RequestLike, response: ResponseLike, next: NextFunction) => {
    if (options.skip?.(request)) return next();

    void (async () => {
      const key = `ratelimit:${options.name}:${rateLimitSubject(request)}`;
      const cost = Math.max(1, Math.trunc(options.cost?.(request) ?? 1));
      let decision: RateLimitDecision | undefined;

      try {
        decision = await store.consume(key, options.windowMs, cost);
      } catch {
        decision = undefined;
      }

      // The shared store is unreachable: fall back to the local counter rather than
      // letting traffic through unmetered.
      decision ??= await fallback.consume(key, options.windowMs, cost).catch(() => undefined);

      if (!decision) return next();

      response.setHeader('ratelimit-limit', options.max);
      response.setHeader('ratelimit-remaining', Math.max(0, options.max - decision.count));
      response.setHeader('ratelimit-reset', Math.ceil(decision.resetInMs / 1000));

      if (decision.count > options.max) {
        response.setHeader('retry-after', Math.ceil(decision.resetInMs / 1000));
        response.status(429).json({ message: 'Too many requests' });
        return;
      }

      next();
    })();
  };
}

/**
 * Prefers the API key over the IP: many containers behind one NAT share an address, and one
 * noisy tenant should not spend another tenant's budget.
 */
export function rateLimitSubject(request: RequestLike) {
  const apiKey = headerValue(request, 'x-api-key');
  // Hashed, never raw: the bucket name ends up in Redis and in logs.
  if (apiKey) return `key:${createHash('sha256').update(apiKey).digest('hex').slice(0, 32)}`;

  return `ip:${request.ip || request.socket?.remoteAddress || 'unknown'}`;
}

function headerValue(request: RequestLike, name: string) {
  const value = request.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}
