import { Injectable } from '@nestjs/common';
import { AiAnalysisOutput } from './ai-provider.interface';

@Injectable()
export class AiAnalysisValidator {
  validate(output: unknown): AiAnalysisOutput {
    if (!output || typeof output !== 'object') {
      throw new Error('AI output must be an object');
    }

    const value = output as Record<string, unknown>;
    const confidence = value.confidence;

    if (
      typeof value.summary !== 'string' ||
      typeof value.possibleCause !== 'string' ||
      typeof value.impact !== 'string' ||
      !Array.isArray(value.suggestedActions) ||
      !value.suggestedActions.every((item) => typeof item === 'string') ||
      (confidence !== 'low' && confidence !== 'medium' && confidence !== 'high')
    ) {
      throw new Error('AI output does not match expected schema');
    }

    return {
      summary: value.summary,
      possibleCause: value.possibleCause,
      impact: value.impact,
      suggestedActions: value.suggestedActions,
      confidence,
    };
  }
}
