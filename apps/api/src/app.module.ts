import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule, LogQueueModule, PinoLogger } from '../../../packages/shared/src';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    LogQueueModule,
    HealthModule,
  ],
  providers: [PinoLogger],
})
export class AppModule {}
