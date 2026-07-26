import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  AiAnalysisCoreModule,
  DatabaseModule,
  LogQueueModule,
  MetricsModule,
  PinoLogger,
  ProjectEventsService,
  validateRuntimeEnv,
} from '../../../packages/shared/src';
import { AlertDispatcherService } from './alerts/alert-dispatcher.service';
import { IncidentAnalysisProcessor } from './analysis/incident-analysis.processor';
import { IncidentAnalysisProducer } from './analysis/incident-analysis.producer';
import { LogProcessor } from './log.processor';
import { RetentionService } from './maintenance/retention.service';
import { QueueDepthCollector } from './metrics/queue-depth.collector';
import { LogProcessingService } from './log-processing.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateRuntimeEnv }),
    DatabaseModule,
    LogQueueModule,
    MetricsModule,
    AiAnalysisCoreModule,
  ],
  providers: [
    PinoLogger,
    LogProcessor,
    LogProcessingService,
    AlertDispatcherService,
    IncidentAnalysisProducer,
    IncidentAnalysisProcessor,
    ProjectEventsService,
    QueueDepthCollector,
    RetentionService,
  ],
})
export class AppModule {}
