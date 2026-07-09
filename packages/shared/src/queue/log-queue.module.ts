import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DEFAULT_REDIS_URL, LOG_PROCESSING_QUEUE } from '../constants';
import { redisOptionsFromUrl } from '../redis/redis-options';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisOptionsFromUrl(config.get<string>('REDIS_URL') ?? DEFAULT_REDIS_URL),
      }),
    }),
    BullModule.registerQueue({
      name: LOG_PROCESSING_QUEUE,
    }),
  ],
  exports: [BullModule],
})
export class LogQueueModule {}
