type RateLimitOptions = {
  name: string;
  windowMs: number;
  max: number;
};

type RequestLike = {
  ip?: string;
  socket: { remoteAddress?: string };
};
type ResponseLike = {
  setHeader(name: string, value: string | number): void;
  status(code: number): { json(body: unknown): void };
};
type NextFunction = () => void;

export function createRateLimit(options: RateLimitOptions) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  let nextCleanupAt = 0;

  return (request: RequestLike, response: ResponseLike, next: NextFunction) => {
    const now = Date.now();
    if (now >= nextCleanupAt) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
      }
      nextCleanupAt = now + options.windowMs;
    }

    const key = `${options.name}:${clientIp(request)}`;
    const current = buckets.get(key);
    const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + options.windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > options.max) {
      response.setHeader('retry-after', Math.ceil((bucket.resetAt - now) / 1000));
      response.status(429).json({ message: 'Too many requests' });
      return;
    }

    next();
  };
}

function clientIp(request: RequestLike) {
  return request.ip || request.socket.remoteAddress || 'unknown';
}
