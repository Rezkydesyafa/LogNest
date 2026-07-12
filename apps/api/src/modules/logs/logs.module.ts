import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  LogQueueModule,
  ParsedLog,
  ParsedLogSchema,
  RawLog,
  RawLogSchema,
} from '../../../../../packages/shared/src';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AuthModule } from '../auth/auth.module';
import { ServicesModule } from '../services/services.module';
import { LogQueueProducer } from './log-queue.producer';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';

@Module({
  imports: [
    AuthModule,
    ApiKeysModule,
    ServicesModule,
    LogQueueModule,
    MongooseModule.forFeature([
      { name: RawLog.name, schema: RawLogSchema },
      { name: ParsedLog.name, schema: ParsedLogSchema },
    ]),
  ],
  controllers: [LogsController],
  providers: [LogsService, LogQueueProducer],
})
export class LogsModule {}
