import { randomBytes } from 'crypto';
import { describe, expect, it } from 'vitest';
import { isSealed, open, openMaybeSealed, resolveEncryptionKey, seal, sealIfPossible } from './secret-box';

const key = randomBytes(32);
const config = { webhookUrl: 'https://hooks.slack.com/services/T000/B000/xyz', chatId: '-100' };

describe('resolveEncryptionKey', () => {
  it('returns undefined when unset, so a deployment without a key still boots', () => {
    expect(resolveEncryptionKey()).toBeUndefined();
    expect(resolveEncryptionKey('')).toBeUndefined();
  });

  it('accepts 32 bytes as hex or base64', () => {
    expect(resolveEncryptionKey(key.toString('hex'))).toEqual(key);
    expect(resolveEncryptionKey(key.toString('base64'))).toEqual(key);
  });

  it.each(['short', randomBytes(16).toString('hex'), randomBytes(48).toString('base64')])(
    'rejects a key of the wrong length (%s)',
    (raw) => {
      expect(() => resolveEncryptionKey(raw)).toThrow(/32 bytes/);
    },
  );
});

describe('seal and open', () => {
  it('round-trips a value', () => {
    expect(open(seal(config, key), key)).toEqual(config);
  });

  it('never leaves the plaintext visible in the stored value', () => {
    const sealed = seal(config, key);

    expect(JSON.stringify(sealed)).not.toContain('hooks.slack.com');
    expect(JSON.stringify(sealed)).not.toContain('-100');
    expect(sealed.$enc.startsWith('v1.')).toBe(true);
  });

  it('produces a different ciphertext every time for the same input', () => {
    expect(seal(config, key).$enc).not.toBe(seal(config, key).$enc);
  });

  it('rejects a value sealed with a different key', () => {
    expect(() => open(seal(config, key), randomBytes(32))).toThrow();
  });

  it('rejects a tampered ciphertext instead of returning garbage', () => {
    const sealed = seal(config, key);
    const [version, iv, tag, ciphertext] = sealed.$enc.split('.');
    const flipped = Buffer.from(ciphertext, 'base64url');
    flipped[0] ^= 0xff;

    expect(() => open({ $enc: [version, iv, tag, flipped.toString('base64url')].join('.') }, key)).toThrow();
  });

  it.each(['', 'garbage', 'v2.a.b.c', 'v1.a'])('rejects the malformed envelope %j', ($enc) => {
    expect(() => open({ $enc }, key)).toThrow();
  });
});

describe('isSealed', () => {
  it('recognises the envelope and nothing else', () => {
    expect(isSealed(seal(config, key))).toBe(true);
    expect(isSealed(config)).toBe(false);
    expect(isSealed(null)).toBe(false);
    expect(isSealed('string')).toBe(false);
    expect(isSealed({ $enc: 42 })).toBe(false);
  });
});

describe('backwards compatibility', () => {
  it('reads a plaintext row written before encryption was enabled', () => {
    expect(openMaybeSealed(config, key)).toEqual(config);
    expect(openMaybeSealed(config)).toEqual(config);
  });

  it('reads an encrypted row when the key is available', () => {
    expect(openMaybeSealed(seal(config, key), key)).toEqual(config);
  });

  it('fails loudly when the row is encrypted but the key is gone', () => {
    expect(() => openMaybeSealed(seal(config, key))).toThrow(/not configured/);
  });

  it('stores plaintext when no key is configured', () => {
    expect(sealIfPossible(config)).toEqual(config);
    expect(isSealed(sealIfPossible(config, key))).toBe(true);
  });
});
