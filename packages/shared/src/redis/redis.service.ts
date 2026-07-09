import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { DEFAULT_REDIS_URL } from '../constants';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client?: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.client = new Redis(this.config.get<string>('REDIS_URL') ?? DEFAULT_REDIS_URL);
  }

  async ping() {
    return this.client?.ping();
  }

  async countInWindow(key: string, member: string, nowMs: number, windowMs: number) {
    if (!this.client) return 0;

    const min = nowMs - windowMs;
    await this.client.zremrangebyscore(key, 0, min);
    await this.client.zadd(key, nowMs, member);
    await this.client.pexpire(key, windowMs);

    return this.client.zcount(key, min, nowMs);
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }
}
