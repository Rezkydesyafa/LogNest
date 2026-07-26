import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('applies defaults for an empty environment', () => {
    const config = loadConfig({});

    expect(config).toMatchObject({
      apiKey: '',
      endpoint: 'http://localhost:3000/logs/ingest',
      bulkEndpoint: 'http://localhost:3000/logs/ingest/bulk',
      composeProjects: [],
      composeServices: [],
      defaultEnvironment: 'development',
      retryAttempts: 3,
      retryDelayMs: 1000,
      batchSize: 100,
      batchIntervalMs: 1000,
      maxQueueSize: 10000,
    });
  });

  it('derives the bulk endpoint from a custom ingest endpoint', () => {
    expect(loadConfig({ LOGMIND_INGEST_ENDPOINT: 'https://x/backend/logs/ingest' }).bulkEndpoint).toBe(
      'https://x/backend/logs/ingest/bulk',
    );
    expect(
      loadConfig({
        LOGMIND_INGEST_ENDPOINT: 'https://x/logs/ingest',
        LOGMIND_BULK_INGEST_ENDPOINT: 'https://y/custom-bulk',
      }).bulkEndpoint,
    ).toBe('https://y/custom-bulk');
  });

  it('clamps the batch size to what the API accepts', () => {
    expect(loadConfig({ LOGMIND_AGENT_BATCH_SIZE: '5000' }).batchSize).toBe(500);
    expect(loadConfig({ LOGMIND_AGENT_BATCH_SIZE: '0' }).batchSize).toBe(100);
    expect(loadConfig({ LOGMIND_AGENT_BATCH_SIZE: '25' }).batchSize).toBe(25);
  });

  it('parses comma separated allowlists and trims whitespace', () => {
    const config = loadConfig({
      LOGMIND_COMPOSE_PROJECTS: 'docker, other ,',
      LOGMIND_COMPOSE_SERVICES: 'backend,celery_worker',
    });

    expect(config.composeProjects).toEqual(['docker', 'other']);
    expect(config.composeServices).toEqual(['backend', 'celery_worker']);
  });

  it('falls back on invalid numeric values', () => {
    const config = loadConfig({
      LOGMIND_AGENT_RETRY_ATTEMPTS: 'bad',
      LOGMIND_AGENT_RETRY_DELAY_MS: '-1',
    });

    expect(config.retryAttempts).toBe(3);
    expect(config.retryDelayMs).toBe(1000);
  });

  it('reads explicit overrides', () => {
    const config = loadConfig({
      LOGMIND_API_KEY: 'lm_server_x',
      LOGMIND_INGEST_ENDPOINT: 'https://logmind.example.com/backend/logs/ingest',
      LOGMIND_DEFAULT_ENVIRONMENT: 'production',
      LOGMIND_AGENT_RETRY_ATTEMPTS: '5',
    });

    expect(config.apiKey).toBe('lm_server_x');
    expect(config.endpoint).toBe('https://logmind.example.com/backend/logs/ingest');
    expect(config.defaultEnvironment).toBe('production');
    expect(config.retryAttempts).toBe(5);
  });
});
