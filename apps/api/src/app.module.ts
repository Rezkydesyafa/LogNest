import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule, LogQueueModule, PinoLogger } from '../../../packages/shared/src';
import { HealthModule } from './health/health.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { AiAnalysisModule } from './modules/ai-analysis/ai-analysis.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { LogsModule } from './modules/logs/logs.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ServicesModule } from './modules/services/services.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
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
  ],
  providers: [PinoLogger],
})
export class AppModule {}
