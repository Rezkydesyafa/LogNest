import { strict as assert } from 'assert';
import { validateAiAnalysis } from '../apps/api/src/modules/ai-analysis/ai-analysis-validator';
import { OpenAiProvider } from '../apps/api/src/modules/ai-analysis/openai.provider';
import { buildPrompt } from '../apps/api/src/modules/ai-analysis/prompt-builder';

async function main() {
  const output = validateAiAnalysis({
    summary: 'Payment service mengalami error 500 berulang pada endpoint /checkout.',
    possibleCause: 'Kemungkinan terjadi database timeout.',
    impact: 'User mungkin gagal melakukan checkout.',
    suggestedActions: ['Periksa koneksi database.'],
    confidence: 'medium',
  });

  assert.equal(output.confidence, 'medium');
  assert.throws(() => validateAiAnalysis({ summary: 'bad' }));

  const incident = {
    id: 'incident_1',
    projectId: 'project_1',
    serviceId: 'service_1',
    fingerprint: 'abc',
    title: 'database timeout',
    severity: 'HIGH',
    status: 'OPEN',
    occurrenceCount: 5,
    firstSeenAt: new Date('2026-07-08T10:00:00.000Z'),
    lastSeenAt: new Date('2026-07-08T10:10:00.000Z'),
    lastRawLogId: 'raw_1',
    aiSummary: null,
    aiPossibleCause: null,
    aiImpact: null,
    aiSuggestedActions: [],
    aiConfidence: null,
    aiLastAnalyzedAt: null,
    aiError: null,
    resolvedAt: null,
    createdAt: new Date('2026-07-08T10:00:00.000Z'),
    updatedAt: new Date('2026-07-08T10:10:00.000Z'),
    service: {
      id: 'service_1',
      projectId: 'project_1',
      name: 'payment-service',
      environment: 'development',
      sourceTypes: ['api'],
      metadata: null,
      lastSeenAt: new Date('2026-07-08T10:10:00.000Z'),
      logCount: 5,
      errorCount: 5,
      createdAt: new Date('2026-07-08T10:00:00.000Z'),
      updatedAt: new Date('2026-07-08T10:10:00.000Z'),
    },
  } as never;
  const sampleLogs = [{ message: 'Database timeout', api: { path: '/checkout', statusCode: 500 } }];
  const prompt = buildPrompt({ incident, sampleLogs });

  assert.equal(prompt.includes('expectedOutput'), true);

  const provider = new OpenAiProvider({
    get: (key: string) => ({ OPENAI_MODEL: 'test-model' })[key],
  } as never);
  const placeholder = await provider.analyzeIncident({ incident, sampleLogs, prompt });

  assert.equal(provider.model, 'test-model');
  assert.equal(placeholder.confidence, 'low');
  assert.equal(placeholder.summary.includes('payment-service'), true);

  console.log('phase5 self-check passed');
}

void main();
