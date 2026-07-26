import { describe, expect, it } from 'vitest';
import { MASK, isSensitiveKey, maskSensitiveData, redactDeep, redactText } from './redaction';

describe('isSensitiveKey', () => {
  it.each(['password', 'userPassword', 'AUTHORIZATION', 'x-api-key', 'refreshToken', 'clientSecret'])(
    'flags %s',
    (key) => {
      expect(isSensitiveKey(key)).toBe(true);
    },
  );

  it.each(['email', 'serviceName', 'statusCode', 'path'])('leaves %s alone', (key) => {
    expect(isSensitiveKey(key)).toBe(false);
  });
});

describe('redactText', () => {
  it('returns empty input untouched', () => {
    expect(redactText('')).toBe('');
  });

  it('leaves an ordinary message alone', () => {
    const message = 'Database connection timeout after 30s on /checkout';
    expect(redactText(message)).toBe(message);
  });

  it('redacts a JWT embedded in a message', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEifQ.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

    expect(redactText(`auth failed for token ${jwt}`)).toBe(`auth failed for token ${MASK}`);
  });

  it('redacts an Authorization header value in one pass', () => {
    expect(redactText('header: Authorization: Bearer abc123def456ghi')).toBe(
      `header: Authorization: ${MASK}`,
    );
  });

  it('redacts a standalone Bearer credential with no key in front of it', () => {
    expect(redactText('retrying with Bearer abc123def456ghi now')).toBe(`retrying with ${MASK} now`);
  });

  it.each([
    ['logmind server key', 'lm_server_AbCdEf0123456789xyzXYZ'],
    ['openai key', 'sk-proj-AbCdEf0123456789xyz'],
    ['github token', 'ghp_AbCdEf0123456789xyzXYZ'],
    ['aws access key', 'AKIAIOSFODNN7EXAMPLE'],
    ['slack token', 'xoxb-1234567890-abcdefghijk'],
  ])('redacts a %s', (_label, secret) => {
    const output = redactText(`request rejected using ${secret} at 10:00`);

    expect(output).not.toContain(secret);
    expect(output).toContain(MASK);
  });

  it('redacts the password inside a connection string but keeps the host', () => {
    const output = redactText('failed to reach postgresql://logmind:sup3rs3cret@db.internal:5432/logmind');

    expect(output).not.toContain('sup3rs3cret');
    expect(output).toContain('db.internal:5432/logmind');
  });

  it.each([
    'password=hunter2',
    'password: hunter2',
    '"token": "abc123xyz"',
    "api_key: 'abc123xyz'",
    'clientSecret=abc123xyz',
  ])('redacts the inline assignment %j', (fragment) => {
    const output = redactText(`request body ${fragment} rejected`);

    expect(output).not.toMatch(/hunter2|abc123xyz/);
    expect(output).toContain(MASK);
  });

  it('redacts email addresses', () => {
    expect(redactText('user rezky@example.com not found')).toBe(`user ${MASK} not found`);
  });

  it('redacts a valid card number but leaves other long digit runs alone', () => {
    expect(redactText('charge failed for 4242424242424242')).toBe(`charge failed for ${MASK}`);
    expect(redactText('charge failed for 4242 4242 4242 4242')).toBe(`charge failed for ${MASK}`);
    expect(redactText('trace id 1234567890123456')).toBe('trace id 1234567890123456');
  });

  it('redacts a whole private key block', () => {
    const key = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIB\nAQ==\n-----END RSA PRIVATE KEY-----';

    expect(redactText(`startup failed\n${key}\nexiting`)).toBe(`startup failed\n${MASK}\nexiting`);
  });

  it('redacts every occurrence, not just the first', () => {
    const output = redactText('a@b.com and c@d.com');

    expect(output).toBe(`${MASK} and ${MASK}`);
  });
});

describe('redactDeep', () => {
  it('masks sensitive keys and redacts secrets inside remaining strings', () => {
    expect(
      redactDeep({
        password: 'hunter2',
        note: 'contact rezky@example.com',
        nested: { authorization: 'Bearer abc', keep: 'ok' },
        list: [{ cookie: 'sid=1' }, 'sk-AbCdEf0123456789xyz'],
      }),
    ).toEqual({
      password: MASK,
      note: `contact ${MASK}`,
      nested: { authorization: MASK, keep: 'ok' },
      list: [{ cookie: MASK }, MASK],
    });
  });

  it('passes primitives, null, and dates through', () => {
    const date = new Date('2026-07-26T10:00:00.000Z');

    expect(redactDeep(42)).toBe(42);
    expect(redactDeep(null)).toBeNull();
    expect(redactDeep(undefined)).toBeUndefined();
    expect(redactDeep(date)).toBe(date);
  });

  it('stops recursing on deeply nested structures instead of overflowing', () => {
    let nested: Record<string, unknown> = { password: 'hunter2' };
    for (let i = 0; i < 40; i += 1) nested = { child: nested };

    expect(() => redactDeep(nested)).not.toThrow();
  });
});

describe('maskSensitiveData', () => {
  it('masks by key only and leaves string values untouched', () => {
    expect(maskSensitiveData({ password: 'p', note: 'mail me at a@b.com' })).toEqual({
      password: MASK,
      note: 'mail me at a@b.com',
    });
  });

  it('walks arrays and nested objects', () => {
    expect(maskSensitiveData({ list: [{ token: 't' }], nested: { ok: 1 } })).toEqual({
      list: [{ token: MASK }],
      nested: { ok: 1 },
    });
  });
});
