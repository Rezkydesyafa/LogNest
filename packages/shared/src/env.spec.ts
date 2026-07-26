import { describe, expect, it } from 'vitest';
import { validateRuntimeEnv } from './env';

const productionBase = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://example',
  MONGODB_URL: 'mongodb://example',
  REDIS_URL: 'redis://example',
  JWT_SECRET: 'prod-secret',
  AI_PROVIDER_MODE: 'mock',
  ALERT_ENCRYPTION_KEY: 'a'.repeat(64),
};

describe('validateRuntimeEnv', () => {
  it('applies defaults in development', () => {
    const env = validateRuntimeEnv({});

    expect(env.NODE_ENV).toBe('development');
    expect(env.API_PORT).toBe(3000);
    // Short access token; the long-lived credential is the refresh token.
    expect(env.JWT_EXPIRES_IN_SECONDS).toBe(900);
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(30);
    expect(env.AI_PROVIDER_MODE).toBe('mock');
    expect(env.TRUST_PROXY_HOPS).toBe(0);
  });

  it('coerces numeric values and falls back on invalid input', () => {
    const env = validateRuntimeEnv({
      ...productionBase,
      AUTH_RATE_LIMIT_PER_MINUTE: '2',
      INGEST_RATE_LIMIT_PER_MINUTE: 'not-a-number',
      TRUST_PROXY_HOPS: '1',
    });

    expect(env.AUTH_RATE_LIMIT_PER_MINUTE).toBe(2);
    expect(env.INGEST_RATE_LIMIT_PER_MINUTE).toBe(300);
    expect(env.TRUST_PROXY_HOPS).toBe(1);
  });

  it.each(['DATABASE_URL', 'MONGODB_URL', 'REDIS_URL', 'JWT_SECRET'])(
    'rejects production without %s',
    (key) => {
      expect(() => validateRuntimeEnv({ ...productionBase, [key]: '' })).toThrow(key);
    },
  );

  it('rejects the placeholder JWT secret in production', () => {
    expect(() => validateRuntimeEnv({ ...productionBase, JWT_SECRET: 'change-me-in-production' })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('requires an OpenAI key when the openai provider is selected', () => {
    expect(() => validateRuntimeEnv({ ...productionBase, AI_PROVIDER_MODE: 'openai' })).toThrow(
      /OPENAI_API_KEY/,
    );

    expect(
      validateRuntimeEnv({
        ...productionBase,
        AI_PROVIDER_MODE: 'openai',
        OPENAI_API_KEY: 'sk-test',
      }).AI_PROVIDER_MODE,
    ).toBe('openai');
  });

  it('accepts a complete production environment', () => {
    expect(() => validateRuntimeEnv(productionBase)).not.toThrow();
  });

  it('refuses production without an alert encryption key', () => {
    expect(() => validateRuntimeEnv({ ...productionBase, ALERT_ENCRYPTION_KEY: '' })).toThrow(
      /ALERT_ENCRYPTION_KEY/,
    );
  });

  it('does not require an encryption key outside production', () => {
    expect(() => validateRuntimeEnv({})).not.toThrow();
  });

  it('applies the retention defaults', () => {
    const env = validateRuntimeEnv({});

    expect(env.AUDIT_LOG_RETENTION_DAYS).toBe(365);
    expect(env.ALERT_DELIVERY_RETENTION_DAYS).toBe(90);
    expect(env.INCIDENT_EVENT_RETENTION_DAYS).toBe(180);
    expect(env.RETENTION_INTERVAL_MS).toBe(3600000);
  });
});
