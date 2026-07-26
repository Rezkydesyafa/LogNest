import { Incident, Service } from '@prisma/client';

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export type AiConfidence = 'low' | 'medium' | 'high';

export type AiAnalysisOutput = {
  summary: string;
  possibleCause: string;
  impact: string;
  suggestedActions: string[];
  confidence: AiConfidence;
};

export type AiIncidentInput = {
  incident: Incident & { service: Service };
  sampleLogs: Record<string, unknown>[];
  prompt: string;
};

export interface AiProvider {
  readonly provider: string;
  readonly model: string;
  analyzeIncident(input: AiIncidentInput): Promise<AiAnalysisOutput>;
}
