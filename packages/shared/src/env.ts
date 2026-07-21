const REQUIRED_IN_PRODUCTION = ['DATABASE_URL', 'MONGODB_URL', 'REDIS_URL', 'JWT_SECRET'];

export function validateRuntimeEnv(input: Record<string, unknown>) {
  const env = { ...input };
  const nodeEnv = stringValue(env.NODE_ENV) || 'development';

  env.NODE_ENV = nodeEnv;
  env.API_PORT = positiveNumber(env.API_PORT, 3000);
  env.JWT_EXPIRES_IN_SECONDS = positiveNumber(env.JWT_EXPIRES_IN_SECONDS, 86400);
  env.OPENAI_TIMEOUT_MS = positiveNumber(env.OPENAI_TIMEOUT_MS, 15000);
  env.AI_PROVIDER_MODE = stringValue(env.AI_PROVIDER_MODE) || 'mock';
  env.AUTH_RATE_LIMIT_PER_MINUTE = positiveNumber(env.AUTH_RATE_LIMIT_PER_MINUTE, 20);
  env.INGEST_RATE_LIMIT_PER_MINUTE = positiveNumber(env.INGEST_RATE_LIMIT_PER_MINUTE, 300);
  env.TRUST_PROXY_HOPS = nonNegativeInteger(env.TRUST_PROXY_HOPS, 0);

  if (nodeEnv === 'production') {
    for (const key of REQUIRED_IN_PRODUCTION) {
      if (!stringValue(env[key])) throw new Error(`${key} is required in production`);
    }

    if (env.JWT_SECRET === 'change-me-in-production') {
      throw new Error('JWT_SECRET must be changed in production');
    }

    if (env.AI_PROVIDER_MODE === 'openai' && !stringValue(env.OPENAI_API_KEY)) {
      throw new Error('OPENAI_API_KEY is required when AI_PROVIDER_MODE=openai');
    }
  }

  return env;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function positiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
