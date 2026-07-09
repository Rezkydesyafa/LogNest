import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PinoLogger } from '../../../packages/shared/src';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = app.get(PinoLogger);

  app.useLogger(logger);
  logger.log(`Worker started in ${config.get('NODE_ENV') ?? 'development'} mode`);
}

void bootstrap();
