import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MetricsService, PinoLogger } from '../../../packages/shared/src';
import { AppModule } from './app.module';
import { startMetricsServer } from './metrics/metrics-server';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = app.get(PinoLogger);
  const metricsPort = Number(config.get('WORKER_METRICS_PORT') ?? 3002);

  app.useLogger(logger);
  app.enableShutdownHooks();

  const metricsServer = startMetricsServer(app.get(MetricsService), {
    port: metricsPort,
    token: config.get<string>('METRICS_TOKEN'),
  });

  const shutdown = async () => {
    metricsServer.close();
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  logger.log(`Worker started in ${config.get('NODE_ENV') ?? 'development'} mode, metrics on :${metricsPort}`);
}

void bootstrap();
