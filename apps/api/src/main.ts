import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { createRateLimit } from './common/middleware/rate-limit.middleware';
import { PinoLogger } from '../../../packages/shared/src';

const { json, urlencoded } = require('express') as {
  json(options: { limit: string }): unknown;
  urlencoded(options: { extended: boolean; limit: string }): unknown;
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });
  const config = app.get(ConfigService);
  const logger = app.get(PinoLogger);
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  app.useLogger(logger);
  app.use(securityHeaders(isProduction));
  app.use(json({ limit: config.get<string>('REQUEST_BODY_LIMIT') ?? '1mb' }));
  app.use(urlencoded({ extended: false, limit: config.get<string>('REQUEST_BODY_LIMIT') ?? '1mb' }));
  app.enableCors(corsOptions(config));
  app.use('/auth/login', createRateLimit({ name: 'auth', windowMs: 60_000, max: config.get<number>('AUTH_RATE_LIMIT_PER_MINUTE') ?? 20 }));
  app.use('/auth/register', createRateLimit({ name: 'auth', windowMs: 60_000, max: config.get<number>('AUTH_RATE_LIMIT_PER_MINUTE') ?? 20 }));
  app.use('/logs/ingest', createRateLimit({ name: 'ingest', windowMs: 60_000, max: config.get<number>('INGEST_RATE_LIMIT_PER_MINUTE') ?? 300 }));
  app.use('/logs/frontend', createRateLimit({ name: 'ingest', windowMs: 60_000, max: config.get<number>('INGEST_RATE_LIMIT_PER_MINUTE') ?? 300 }));
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  app.useGlobalInterceptors(
    new RequestIdInterceptor(),
    new HttpLoggingInterceptor(logger),
    new ResponseTransformInterceptor(),
  );

  if (!isProduction || config.get<string>('ENABLE_SWAGGER') === 'true') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('LogMind AI API')
        .setDescription('Centralized logging and incident platform API')
        .setVersion('0.1.0')
        .addBearerAuth()
        .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
        .build(),
    );
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'docs-json',
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = config.get<number>('API_PORT') ?? 3000;
  await app.listen(port);
  logger.log(`API listening on http://localhost:${port}`);
}

void bootstrap();

function securityHeaders(isProduction: boolean) {
  return (_request: unknown, response: { setHeader(name: string, value: string): void }, next: () => void) => {
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('x-frame-options', 'DENY');
    response.setHeader('referrer-policy', 'no-referrer');

    if (isProduction) {
      response.setHeader('strict-transport-security', 'max-age=15552000; includeSubDomains');
    }

    next();
  };
}

function corsOptions(config: ConfigService) {
  const origins = (config.get<string>('CORS_ORIGIN') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    origin: origins.length ? origins : config.get<string>('NODE_ENV') !== 'production',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type', 'x-api-key', 'x-request-id'],
  };
}
