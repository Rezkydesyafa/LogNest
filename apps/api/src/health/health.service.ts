import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { PrismaService, RedisService } from '../../../../packages/shared/src';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectConnection() private readonly mongo: Connection,
  ) {}

  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    if (!this.mongo.db) {
      throw new Error('MongoDB connection is not ready');
    }
    await this.mongo.db.admin().ping();
    await this.redis.ping();

    return {
      status: 'ok',
      dependencies: {
        postgres: 'ok',
        mongodb: 'ok',
        redis: 'ok',
      },
    };
  }
}
