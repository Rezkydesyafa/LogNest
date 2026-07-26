const REQUIRED_IN_PRODUCTION = ['DATABASE_URL', 'MONGODB_URL', 'REDIS_URL', 'JWT_SECRET'];

export function validateRuntimeEnv(input: Record<string, unknown>) {
  const env = { ...input };
  const nodeEnv = stringValue(env.NODE_ENV) || 'development';

  env.NODE_ENV = nodeEnv;
  env.API_PORT = positiveNumber(env.API_PORT, 3000);
  // Short access token, long refresh token: revocation depends on the access token
  // expiring quickly, since only the refresh token has server-side state.
  env.JWT_EXPIRES_IN_SECONDS = positiveNumber(env.JWT_EXPIRES_IN_SECONDS, 900);
  env.REFRESH_TOKEN_TTL_DAYS = positiveNumber(env.REFRESH_TOKEN_TTL_DAYS, 30);
  env.PASSWORD_RESET_TTL_MINUTES = positiveNumber(env.PASSWORD_RESET_TTL_MINUTES, 30);
  env.OPENAI_TIMEOUT_MS = positiveNumber(env.OPENAI_TIMEOUT_MS, 15000);
  env.AI_PROVIDER_MODE = stringValue(env.AI_PROVIDER_MODE) || 'mock';
  env.AUTH_RATE_LIMIT_PER_MINUTE = positiveNumber(env.AUTH_RATE_LIMIT_PER_MINUTE, 20);
  env.INGEST_RATE_LIMIT_PER_MINUTE = positiveNumber(env.INGEST_RATE_LIMIT_PER_MINUTE, 300);
  env.READ_RATE_LIMIT_PER_MINUTE = positiveNumber(env.READ_RATE_LIMIT_PER_MINUTE, 120);
  env.API_KEY_CACHE_TTL_MS = positiveNumber(env.API_KEY_CACHE_TTL_MS, 60000);
  env.RETENTION_INTERVAL_MS = positiveNumber(env.RETENTION_INTERVAL_MS, 3600000);
  env.AUDIT_LOG_RETENTION_DAYS = positiveNumber(env.AUDIT_LOG_RETENTION_DAYS, 365);
  env.ALERT_DELIVERY_RETENTION_DAYS = positiveNumber(env.ALERT_DELIVERY_RETENTION_DAYS, 90);
  env.INCIDENT_EVENT_RETENTION_DAYS = positiveNumber(env.INCIDENT_EVENT_RETENTION_DAYS, 180);
  env.INGEST_BULK_MAX_ITEMS = positiveNumber(env.INGEST_BULK_MAX_ITEMS, 500);
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

    // Alert channel configs hold webhook URLs and bot tokens. Without a key they are
    // written to Postgres in the clear, so refuse to start rather than fail quietly.
    if (!stringValue(env.ALERT_ENCRYPTION_KEY)) {
      throw new Error(
        'ALERT_ENCRYPTION_KEY is required in production; generate one with: openssl rand -hex 32',
      );
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
