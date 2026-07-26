import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { createRateLimit, RedisRateLimitStore } from './common/middleware/rate-limit.middleware';
import { MetricsService, PinoLogger, RedisService } from '../../../packages/shared/src';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const config = app.get(ConfigService);
  const logger = app.get(PinoLogger);
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const trustProxyHops = config.get<number>('TRUST_PROXY_HOPS') ?? 0;

  app.useLogger(logger);
  if (trustProxyHops > 0) app.set('trust proxy', trustProxyHops);
  app.use(securityHeaders(isProduction));
  app.use(json({ limit: config.get<string>('REQUEST_BODY_LIMIT') ?? '1mb' }));
  app.use(
    urlencoded({
      extended: false,
      limit: config.get<string>('REQUEST_BODY_LIMIT') ?? '1mb',
    }),
  );
  app.enableCors(corsOptions(config));

  // Counters live in Redis so the limit is shared by every API replica.
  const store = new RedisRateLimitStore(app.get(RedisService));
  const authLimit = {
    name: 'auth',
    windowMs: 60_000,
    max: config.get<number>('AUTH_RATE_LIMIT_PER_MINUTE') ?? 20,
    store,
  };
  const ingestLimit = {
    name: 'ingest',
    windowMs: 60_000,
    max: config.get<number>('INGEST_RATE_LIMIT_PER_MINUTE') ?? 300,
    store,
    // A bulk request carrying 200 logs spends 200 units, so batching improves throughput
    // without letting a client bypass the per-minute log budget.
    cost: bulkBatchSize,
  };

  app.use('/auth/login', createRateLimit(authLimit));
  app.use('/auth/register', createRateLimit(authLimit));
  // The refresh token is a 30-day credential; its exchange endpoint needs the same
  // brute-force ceiling as the password endpoints.
  app.use('/auth/refresh', createRateLimit(authLimit));
  app.use('/auth/logout', createRateLimit(authLimit));
  app.use('/auth/forgot-password', createRateLimit(authLimit));
  app.use('/auth/reset-password', createRateLimit(authLimit));
  app.use('/logs/ingest', createRateLimit(ingestLimit));
  app.use('/logs/frontend', createRateLimit(ingestLimit));

  // Search and dashboard reads are expensive enough to deserve their own ceiling. The
  // /logs mount also matches /logs/ingest, which already has its own budget, so skip it.
  const read = {
    name: 'read',
    windowMs: 60_000,
    max: readLimit(config),
    store,
    skip: isIngestRoute,
  };
  app.use('/logs', createRateLimit(read));
  app.use('/incidents', createRateLimit(read));
  app.use('/dashboard', createRateLimit(read));

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  app.useGlobalInterceptors(
    new RequestIdInterceptor(),
    new MetricsInterceptor(app.get(MetricsService)),
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

  // Without this, onModuleDestroy never runs on deploy: buffered service counters would
  // be dropped and in-flight requests cut off mid-response.
  app.enableShutdownHooks();

  const port = config.get<number>('API_PORT') ?? 3000;
  await app.listen(port);
  logger.log(`API listening on http://localhost:${port}`);
}

void bootstrap();

function readLimit(config: ConfigService) {
  return config.get<number>('READ_RATE_LIMIT_PER_MINUTE') ?? 120;
}

function isIngestRoute(request: { path?: string; url?: string }) {
  const path = request.path ?? request.url ?? '';
  return path.startsWith('/ingest') || path.startsWith('/frontend');
}

function bulkBatchSize(request: { body?: unknown }) {
  const logs = (request.body as { logs?: unknown[] } | undefined)?.logs;
  return Array.isArray(logs) ? logs.length : 1;
}

function securityHeaders(isProduction: boolean) {
  return (
    _request: unknown,
    response: { setHeader(name: string, value: string): void },
    next: () => void,
  ) => {
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
