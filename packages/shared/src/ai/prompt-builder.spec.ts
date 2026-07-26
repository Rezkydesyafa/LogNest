import { ConfigService } from '@nestjs/config';
import { Incident, Service } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { OpenAiProvider } from './openai.provider';
import { buildPrompt } from './prompt-builder';

const service = {
  id: 'service_1',
  projectId: 'project_1',
  name: 'payment-service',
  environment: 'development',
  sourceTypes: ['api'],
  metadata: null,
  lastSeenAt: new Date('2026-07-26T10:10:00.000Z'),
  logCount: 5,
  errorCount: 5,
  createdAt: new Date('2026-07-26T10:00:00.000Z'),
  updatedAt: new Date('2026-07-26T10:10:00.000Z'),
} as unknown as Service;

const incident = {
  id: 'incident_1',
  projectId: 'project_1',
  serviceId: 'service_1',
  fingerprint: 'abc',
  title: 'database timeout',
  severity: 'HIGH',
  status: 'OPEN',
  occurrenceCount: 5,
  firstSeenAt: new Date('2026-07-26T10:00:00.000Z'),
  lastSeenAt: new Date('2026-07-26T10:10:00.000Z'),
  service,
} as unknown as Incident & { service: Service };

const sampleLogs = [{ message: 'Database timeout', api: { path: '/checkout', statusCode: 500 } }];

describe('buildPrompt', () => {
  it('includes the incident context and the expected output shape', () => {
    const prompt = buildPrompt({ incident, sampleLogs });

    expect(prompt).toContain('expectedOutput');
    expect(prompt).toContain('payment-service');
    expect(prompt).toContain('/checkout');
    expect(prompt).toContain('low | medium | high');
  });

  it('caps the sample logs at five entries', () => {
    const many = Array.from({ length: 12 }, (_, index) => ({ message: `log-${index}` }));
    const parsed = JSON.parse(buildPrompt({ incident, sampleLogs: many }).split('\n\n')[1]);

    expect(parsed.sampleLogs).toHaveLength(5);
    expect(parsed.sampleLogs.at(-1).message).toBe('log-4');
  });
});

describe('OpenAiProvider fallback', () => {
  const providerWith = (values: Record<string, unknown> = {}) =>
    new OpenAiProvider({ get: (key: string) => values[key] } as unknown as ConfigService);

  it('reports a placeholder provider when no API key is configured', () => {
    expect(providerWith().provider).toBe('openai-placeholder');
    expect(providerWith({ OPENAI_API_KEY: 'sk-test' }).provider).toBe('openai');
  });

  it('defaults the model and honours an override', () => {
    expect(providerWith().model).toBe('gpt-4.1-mini');
    expect(providerWith({ OPENAI_MODEL: 'test-model' }).model).toBe('test-model');
  });

  it('produces a deterministic local analysis without an API key', async () => {
    const output = await providerWith().analyzeIncident({ incident, sampleLogs, prompt: 'p' });

    expect(output.summary).toContain('payment-service');
    expect(output.summary).toContain('/checkout');
    expect(output.confidence).toBe('low');
    expect(output.suggestedActions.length).toBeGreaterThan(0);
  });

  it('raises confidence once enough sample logs are available', async () => {
    const output = await providerWith().analyzeIncident({
      incident,
      sampleLogs: [sampleLogs[0], sampleLogs[0], sampleLogs[0]],
      prompt: 'p',
    });

    expect(output.confidence).toBe('medium');
  });

  it('surfaces the forced failure switch used by the demo flow', async () => {
    await expect(
      providerWith({ AI_PROVIDER_FORCE_FAIL: 'true' }).analyzeIncident({
        incident,
        sampleLogs,
        prompt: 'p',
      }),
    ).rejects.toThrow(/Forced AI provider failure/);
  });
});
