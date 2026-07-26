import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  DatabaseModule,
  LogQueueModule,
  MetricsModule,
  PinoLogger,
  validateRuntimeEnv,
} from '../../../packages/shared/src';
import { AuditModule } from './common/services/audit.module';
import { ProjectAccessModule } from './common/services/project-access.module';
import { HealthModule } from './health/health.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { AuditHttpModule } from './modules/audit/audit-http.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { AiAnalysisModule } from './modules/ai-analysis/ai-analysis.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EventsModule } from './modules/events/events.module';
import { MetricsHttpModule } from './modules/metrics/metrics.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { LogsModule } from './modules/logs/logs.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ServicesModule } from './modules/services/services.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateRuntimeEnv }),
    DatabaseModule,
    ProjectAccessModule,
    AuditModule,
    MetricsModule,
    MetricsHttpModule,
    LogQueueModule,
    HealthModule,
    AuthModule,
    ProjectsModule,
    ApiKeysModule,
    ServicesModule,
    LogsModule,
    IncidentsModule,
    AiAnalysisModule,
    DashboardModule,
    AlertsModule,
    AuditHttpModule,
    EventsModule,
  ],
  providers: [PinoLogger],
})
export class AppModule {}
