import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { DEFAULT_REDIS_URL } from '../constants';

/**
 * Sliding window counter. The four commands run as one script so two workers counting the
 * same fingerprint can never interleave and read each other's half-applied state.
 */
const SLIDING_WINDOW_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1])
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
redis.call('PEXPIRE', KEYS[1], ARGV[4])
return redis.call('ZCOUNT', KEYS[1], ARGV[1], ARGV[2])
`;

/** Fixed window counter used by the rate limiter. Returns the new count and the remaining TTL. */
const FIXED_WINDOW_SCRIPT = `
local count = redis.call('INCRBY', KEYS[1], ARGV[2])
if count == tonumber(ARGV[2]) then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return { count, redis.call('PTTL', KEYS[1]) }
`;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client?: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.client = new Redis(this.config.get<string>('REDIS_URL') ?? DEFAULT_REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
    });
    // Without a listener ioredis emits an unhandled 'error' event and crashes the process
    // on a transient Redis blip. Every caller already degrades gracefully.
    this.client.on('error', () => undefined);
  }

  get isReady() {
    return this.client?.status === 'ready';
  }

  async ping() {
    return this.client?.ping();
  }

  async countInWindow(key: string, member: string, nowMs: number, windowMs: number) {
    if (!this.client) return 0;

    const count = await this.client.eval(
      SLIDING_WINDOW_SCRIPT,
      1,
      key,
      String(nowMs - windowMs),
      String(nowMs),
      member,
      String(windowMs),
    );

    return Number(count);
  }

  /** Adds `cost` to the counter for `key` and reports how far into the window the caller is. */
  async consumeFixedWindow(key: string, windowMs: number, cost = 1) {
    if (!this.client) return undefined;

    const [count, ttl] = (await this.client.eval(
      FIXED_WINDOW_SCRIPT,
      1,
      key,
      String(windowMs),
      String(cost),
    )) as [number, number];

    return { count: Number(count), resetInMs: ttl > 0 ? Number(ttl) : windowMs };
  }

  async getJson<T>(key: string): Promise<T | undefined> {
    if (!this.client) return undefined;

    const raw = await this.client.get(key);
    if (!raw) return undefined;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  async setJson(key: string, value: unknown, ttlMs: number) {
    if (!this.client) return;
    await this.client.set(key, JSON.stringify(value), 'PX', ttlMs);
  }

  async del(...keys: string[]) {
    if (!this.client || !keys.length) return;
    await this.client.del(...keys);
  }

  /** Returns true only for the first caller inside `ttlMs`. Used to throttle repeated writes. */
  async claim(key: string, ttlMs: number) {
    if (!this.client) return true;
    return (await this.client.set(key, '1', 'PX', ttlMs, 'NX')) === 'OK';
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => undefined);
  }
}
