import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule, LogQueueModule, PinoLogger } from '../../../packages/shared/src';
import { LogProcessor } from './log.processor';
import { LogProcessingService } from './log-processing.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    LogQueueModule,
  ],
  providers: [PinoLogger, LogProcessor, LogProcessingService],
})
export class AppModule {}
