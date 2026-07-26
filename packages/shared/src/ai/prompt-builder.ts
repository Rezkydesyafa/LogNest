import { Incident, Service } from '@prisma/client';

export function buildPrompt(input: {
  incident: Incident & { service: Service };
  sampleLogs: Record<string, unknown>[];
}) {
  const payload = {
    incident: {
      id: input.incident.id,
      serviceName: input.incident.service.name,
      environment: input.incident.service.environment,
      fingerprint: input.incident.fingerprint,
      title: input.incident.title,
      severity: input.incident.severity,
      occurrenceCount: input.incident.occurrenceCount,
      firstSeenAt: input.incident.firstSeenAt,
      lastSeenAt: input.incident.lastSeenAt,
    },
    sampleLogs: input.sampleLogs.slice(0, 5),
    expectedOutput: {
      summary: 'string',
      possibleCause: 'string',
      impact: 'string',
      suggestedActions: ['string'],
      confidence: 'low | medium | high',
    },
  };

  return [
    'Analyze this LogMind AI incident and return only valid JSON in the expected output shape.',
    JSON.stringify(payload, null, 2),
  ].join('\n\n');
}
