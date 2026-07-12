import { strict as assert } from 'assert';
import { validateRuntimeEnv } from '../packages/shared/src/env';
import { createRateLimit } from '../apps/api/src/common/middleware/rate-limit.middleware';
import { extractOutputText } from '../apps/api/src/modules/ai-analysis/openai.provider';

function main() {
  assert.throws(() =>
    validateRuntimeEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://example',
      MONGODB_URL: 'mongodb://example',
      REDIS_URL: 'redis://example',
      JWT_SECRET: 'change-me-in-production',
      AI_PROVIDER_MODE: 'mock',
    }),
  );

  assert.throws(() =>
    validateRuntimeEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://example',
      MONGODB_URL: 'mongodb://example',
      REDIS_URL: 'redis://example',
      JWT_SECRET: 'prod-secret',
      AI_PROVIDER_MODE: 'openai',
    }),
  );

  const env = validateRuntimeEnv({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://example',
    MONGODB_URL: 'mongodb://example',
    REDIS_URL: 'redis://example',
    JWT_SECRET: 'prod-secret',
    AI_PROVIDER_MODE: 'mock',
    AUTH_RATE_LIMIT_PER_MINUTE: '2',
  });
  assert.equal(env.AUTH_RATE_LIMIT_PER_MINUTE, 2);
  assert.equal(env.AI_PROVIDER_MODE, 'mock');

  assert.equal(
    extractOutputText({
      output: [{ content: [{ type: 'output_text', text: '{"summary":"ok"}' }] }],
    }),
    '{"summary":"ok"}',
  );

  let statusCode = 0;
  const limiter = createRateLimit({ name: 'test', windowMs: 60_000, max: 1 });
  const request = { headers: {}, ip: '127.0.0.1', socket: {} };
  const response = {
    setHeader: () => undefined,
    status: (code: number) => {
      statusCode = code;
      return response;
    },
    json: () => undefined,
  };

  limiter(request as never, response as never, () => undefined);
  limiter(request as never, response as never, () => undefined);
  assert.equal(statusCode, 429);

  console.log('production self-check passed');
}

main();
