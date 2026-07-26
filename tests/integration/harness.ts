import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../apps/api/src/app.module';
import { GlobalExceptionFilter } from '../../apps/api/src/common/filters/global-exception.filter';
import { ResponseTransformInterceptor } from '../../apps/api/src/common/interceptors/response-transform.interceptor';
import { PinoLogger } from '../../packages/shared/src';

export type TestApi = {
  app: NestExpressApplication;
  http: () => request.Agent;
  prisma: PrismaClient;
  close: () => Promise<void>;
};

/**
 * Boots the real API against the containers from global setup.
 *
 * Only the pieces that shape responses are registered — the rate limiter and HTTP logger are
 * left out so tests are not throttled by each other or noisy in CI.
 */
export async function startApi(): Promise<TestApi> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
  const logger = app.get(PinoLogger);

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  app.useGlobalInterceptors(new ResponseTransformInterceptor());
  await app.init();

  const prisma = new PrismaClient();

  return {
    app,
    http: () => request(app.getHttpServer()),
    prisma,
    close: async () => {
      await prisma.$disconnect();
      await app.close();
    },
  };
}

/** Registers a fresh user and returns its bearer token plus a project to work in. */
export async function seedUserWithProject(api: TestApi, suffix = randomSuffix()) {
  const email = `user-${suffix}@example.com`;
  const register = await api
    .http()
    .post('/auth/register')
    .send({ email, password: 'password123', name: `User ${suffix}` })
    .expect(201);

  const { accessToken, refreshToken, user } = register.body.data;
  const project = await api
    .http()
    .post('/projects')
    .set('authorization', `Bearer ${accessToken}`)
    .send({ name: `Project ${suffix}`, timezone: 'Asia/Jakarta' })
    .expect(201);

  return {
    email,
    password: 'password123',
    user,
    accessToken,
    refreshToken,
    project: project.body.data as { id: string; name: string },
  };
}

export async function createServerKey(api: TestApi, accessToken: string, projectId: string) {
  const response = await api
    .http()
    .post(`/projects/${projectId}/api-keys`)
    .set('authorization', `Bearer ${accessToken}`)
    .send({ name: 'integration', type: 'SERVER' })
    .expect(201);

  return response.body.data.key as string;
}

/** Polls until `check` returns a value, so a test never depends on a fixed sleep. */
export async function waitFor<T>(
  check: () => Promise<T | undefined | null>,
  { timeoutMs = 20_000, intervalMs = 200, label = 'condition' } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const result = await check();
    if (result) return result;

    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}
