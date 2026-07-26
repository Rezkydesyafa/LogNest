import { describe, expect, it } from 'vitest';
import { generateFingerprint, normalizeLogMessage, stackTraceHash } from './fingerprint';

describe('normalizeLogMessage', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeLogMessage('  Database   CONNECTION  timeout ')).toBe('database connection timeout');
  });

  it('replaces object ids, uuids, and numbers with placeholders', () => {
    expect(normalizeLogMessage('user 507f1f77bcf86cd799439011 not found')).toBe('user <object_id> not found');
    expect(normalizeLogMessage('order 123e4567-e89b-12d3-a456-426614174000 failed')).toBe(
      'order <uuid> failed',
    );
    expect(normalizeLogMessage('retry attempt 42 of 5')).toBe('retry attempt <number> of <number>');
  });
});

describe('stackTraceHash', () => {
  it('returns undefined without a stack trace', () => {
    expect(stackTraceHash()).toBeUndefined();
  });

  it('is stable for the same leading frames', () => {
    const frames = ['Error: boom', '  at a (a.ts:1)', '  at b (b.ts:2)'].join('\n');
    expect(stackTraceHash(frames)).toBe(stackTraceHash(frames));
  });

  it('ignores frames beyond the first five', () => {
    const head = ['Error: boom', '  at a', '  at b', '  at c', '  at d'].join('\n');
    expect(stackTraceHash(head)).toBe(stackTraceHash(`${head}\n  at e\n  at f`));
  });
});

describe('generateFingerprint', () => {
  const base = {
    serviceName: 'payment-service',
    sourceType: 'api',
    level: 'error',
    message: 'Database connection timeout',
  };

  it('groups messages that differ only by volatile ids', () => {
    const first = generateFingerprint({ ...base, message: 'order 12 failed' });
    const second = generateFingerprint({ ...base, message: 'order 987 failed' });

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.normalizedMessage).toBe('order <number> failed');
  });

  it('separates different services', () => {
    const a = generateFingerprint(base);
    const b = generateFingerprint({ ...base, serviceName: 'order-service' });

    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it('separates different api paths and status codes', () => {
    const a = generateFingerprint({ ...base, api: { path: '/pay', statusCode: 500 } });
    const b = generateFingerprint({ ...base, api: { path: '/refund', statusCode: 500 } });
    const c = generateFingerprint({ ...base, api: { path: '/pay', statusCode: 503 } });

    expect(a.fingerprint).not.toBe(b.fingerprint);
    expect(a.fingerprint).not.toBe(c.fingerprint);
  });

  it('exposes the stack trace hash when a stack trace is present', () => {
    const withStack = generateFingerprint({ ...base, stackTrace: 'Error: boom\n  at a' });
    const withoutStack = generateFingerprint(base);

    expect(withStack.stackTraceHash).toMatch(/^[0-9a-f]{12}$/);
    expect(withoutStack.stackTraceHash).toBeUndefined();
    expect(withStack.fingerprint).not.toBe(withoutStack.fingerprint);
  });
});
