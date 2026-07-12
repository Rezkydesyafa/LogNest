import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiAnalysisOutput, AiIncidentInput, AiProvider } from './ai-provider.interface';

@Injectable()
export class OpenAiProvider implements AiProvider {
  constructor(private readonly config: ConfigService) {}

  get provider() {
    return this.apiKey ? 'openai' : 'openai-placeholder';
  }

  get model() {
    return this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4.1-mini';
  }

  async analyzeIncident(input: AiIncidentInput): Promise<AiAnalysisOutput> {
    if (this.config.get<string>('AI_PROVIDER_FORCE_FAIL') === 'true') {
      throw new Error('Forced AI provider failure');
    }

    if (this.apiKey) {
      return this.callOpenAi(input.prompt);
    }

    return this.fallbackAnalysis(input);
  }

  private get apiKey() {
    return this.config.get<string>('OPENAI_API_KEY');
  }

  private async callOpenAi(prompt: string): Promise<AiAnalysisOutput> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.get<number>('OPENAI_TIMEOUT_MS') ?? 15000,
    );

    try {
      const response = await fetch(`${this.baseUrl}/responses`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: [
            {
              role: 'system',
              content: 'Return a concise LogMind incident analysis as JSON only.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'incident_analysis',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['summary', 'possibleCause', 'impact', 'suggestedActions', 'confidence'],
                properties: {
                  summary: { type: 'string' },
                  possibleCause: { type: 'string' },
                  impact: { type: 'string' },
                  suggestedActions: { type: 'array', items: { type: 'string' } },
                  confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
                },
              },
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI request failed: ${response.status}`);
      }

      return JSON.parse(extractOutputText(await response.json())) as AiAnalysisOutput;
    } finally {
      clearTimeout(timeout);
    }
  }

  private get baseUrl() {
    return (this.config.get<string>('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  }

  private fallbackAnalysis(input: AiIncidentInput): AiAnalysisOutput {
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

export function extractOutputText(response: unknown) {
  const value = response as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ type?: string; text?: unknown }> }>;
  };

  if (typeof value.output_text === 'string') {
    return value.output_text;
  }

  for (const item of value.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        return content.text;
      }
    }
  }

  throw new Error('OpenAI response did not contain output text');
}
