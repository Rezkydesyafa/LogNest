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

  async onModuleDestroy() {
    await this.client?.quit();
  }
}
