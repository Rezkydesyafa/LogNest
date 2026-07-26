import { describe, expect, it } from 'vitest';
import { validateAiAnalysis } from './ai-analysis-validator';

const valid = {
  summary: 'Payment service keeps timing out.',
  possibleCause: 'Database connection pool exhausted.',
  impact: 'Checkout requests fail for some users.',
  suggestedActions: ['Check the pool size', 'Inspect slow queries'],
  confidence: 'high',
};

describe('validateAiAnalysis', () => {
  it('accepts a well formed payload and strips unknown fields', () => {
    expect(validateAiAnalysis({ ...valid, hallucinatedField: 'ignore me' })).toEqual(valid);
  });

  it.each(['low', 'medium', 'high'])('accepts confidence %s', (confidence) => {
    expect(validateAiAnalysis({ ...valid, confidence }).confidence).toBe(confidence);
  });

  it.each([null, undefined, 'string', 42])('rejects non-object output %j', (output) => {
    expect(() => validateAiAnalysis(output)).toThrow(/must be an object/);
  });

  it.each([
    ['missing summary', { ...valid, summary: undefined }],
    ['non-string impact', { ...valid, impact: 12 }],
    ['suggestedActions not an array', { ...valid, suggestedActions: 'do something' }],
    ['suggestedActions with non-strings', { ...valid, suggestedActions: ['ok', 5] }],
    ['unknown confidence', { ...valid, confidence: 'very-high' }],
  ])('rejects %s', (_label, output) => {
    expect(() => validateAiAnalysis(output)).toThrow(/expected schema/);
  });
});
