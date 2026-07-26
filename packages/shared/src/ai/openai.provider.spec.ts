import { describe, expect, it } from 'vitest';
import { extractOutputText } from './openai.provider';

describe('extractOutputText', () => {
  it('reads the flattened output_text field', () => {
    expect(extractOutputText({ output_text: '{"summary":"ok"}' })).toBe('{"summary":"ok"}');
  });

  it('reads the first output_text content block', () => {
    expect(
      extractOutputText({
        output: [
          { content: [{ type: 'reasoning', text: 'ignored' }] },
          { content: [{ type: 'output_text', text: '{"summary":"ok"}' }] },
        ],
      }),
    ).toBe('{"summary":"ok"}');
  });

  it.each([{}, { output: [] }, { output: [{ content: [] }] }, { output: [{}] }])(
    'throws when no output text is present in %j',
    (response) => {
      expect(() => extractOutputText(response)).toThrow(/did not contain output text/);
    },
  );
});
