import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule, LogQueueModule, PinoLogger } from '../../../packages/shared/src';
import { HealthModule } from './health/health.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/projects.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    LogQueueModule,
    HealthModule,
    AuthModule,
    ProjectsModule,
    ApiKeysModule,
  ],
  providers: [PinoLogger],
})
export class AppModule {}
