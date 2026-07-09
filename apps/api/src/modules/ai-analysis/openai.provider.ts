import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiAnalysisOutput, AiIncidentInput, AiProvider } from './ai-provider.interface';

@Injectable()
export class OpenAiProvider implements AiProvider {
  readonly provider = 'openai-placeholder';

  constructor(private readonly config: ConfigService) {}

  get model() {
    return this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4.1-mini';
  }

  async analyzeIncident(input: AiIncidentInput): Promise<AiAnalysisOutput> {
    if (this.config.get<string>('AI_PROVIDER_FORCE_FAIL') === 'true') {
      throw new Error('Forced AI provider failure');
    }

    const sample = input.sampleLogs[0] ?? {};
    const api = (sample.api ?? {}) as Record<string, unknown>;
    const endpoint = typeof api.path === 'string' ? ` pada endpoint ${api.path}` : '';
    const status = api.statusCode ? ` ${api.statusCode}` : '';
    const serviceName = input.incident.service.name;

    return {
      summary: `${serviceName} mengalami error${status} berulang${endpoint}.`,
      possibleCause: input.incident.title || 'Kemungkinan terjadi error berulang dengan fingerprint yang sama.',
      impact: 'User mungkin mengalami kegagalan pada alur yang bergantung pada service ini.',
      suggestedActions: [
        'Periksa sample log dan stack trace terbaru.',
        'Cek dependency eksternal seperti database, cache, atau API upstream.',
        'Periksa perubahan deploy atau konfigurasi sekitar waktu firstSeenAt.',
      ],
      confidence: input.sampleLogs.length >= 3 ? 'medium' : 'low',
    };
  }
}
