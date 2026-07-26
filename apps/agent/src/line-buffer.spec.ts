import { describe, expect, it } from 'vitest';
import { LineBuffer, MultilineBuffer } from './line-buffer';

describe('LineBuffer', () => {
  it('emits complete lines and keeps the remainder pending', () => {
    const buffer = new LineBuffer();

    expect(buffer.push('line 1\nline')).toEqual(['line 1']);
    expect(buffer.push(' 2\r\n')).toEqual(['line 2']);
    expect(buffer.flush()).toEqual([]);
  });

  it('flushes a trailing line without a newline', () => {
    const buffer = new LineBuffer();

    expect(buffer.push('partial')).toEqual([]);
    expect(buffer.flush()).toEqual(['partial']);
    expect(buffer.flush()).toEqual([]);
  });

  it('accepts Buffer chunks and splits multiple lines at once', () => {
    const buffer = new LineBuffer();

    expect(buffer.push(Buffer.from('a\nb\nc\n'))).toEqual(['a', 'b', 'c']);
  });

  it('drops empty lines', () => {
    expect(new LineBuffer().push('a\n\n\nb\n')).toEqual(['a', 'b']);
  });
});

describe('MultilineBuffer', () => {
  it('passes plain lines through untouched', () => {
    const multiline = new MultilineBuffer();

    expect(multiline.push('just a log line')).toEqual(['just a log line']);
  });

  it('groups a Python traceback into a single entry', () => {
    const multiline = new MultilineBuffer();

    expect(multiline.push('Traceback (most recent call last):')).toEqual([]);
    expect(multiline.push('  File "/app/main.py", line 1, in run')).toEqual([]);
    expect(multiline.push('WahaClientError: request failed')).toEqual([
      'Traceback (most recent call last):\n  File "/app/main.py", line 1, in run\nWahaClientError: request failed',
    ]);
  });

  it('flushes a pending traceback on demand', () => {
    const multiline = new MultilineBuffer();

    multiline.push('Traceback (most recent call last):');
    multiline.push('  File "/app/main.py", line 1, in run');

    expect(multiline.flush()).toEqual([
      'Traceback (most recent call last):\n  File "/app/main.py", line 1, in run',
    ]);
    expect(multiline.flush()).toEqual([]);
  });

  it('caps a runaway traceback at 100 lines', () => {
    const multiline = new MultilineBuffer();
    multiline.push('Traceback (most recent call last):');

    let emitted: string[] = [];
    for (let i = 0; i < 200 && !emitted.length; i += 1) {
      emitted = multiline.push(`  frame ${i}`);
    }

    expect(emitted).toHaveLength(1);
    expect(emitted[0].split('\n')).toHaveLength(100);
  });
});
