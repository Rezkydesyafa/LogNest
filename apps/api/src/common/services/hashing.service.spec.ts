import { describe, expect, it } from 'vitest';
import { HashingService } from './hashing.service';

describe('HashingService', () => {
  const hashing = new HashingService();

  it('produces a versioned scrypt hash', async () => {
    const hash = await hashing.hashPassword('password123');

    expect(hash.startsWith('scrypt$v1$')).toBe(true);
    expect(hash.split('$')).toHaveLength(4);
  });

  it('uses a fresh salt for every hash', async () => {
    const [a, b] = await Promise.all([
      hashing.hashPassword('password123'),
      hashing.hashPassword('password123'),
    ]);

    expect(a).not.toBe(b);
  });

  it('verifies the correct password and rejects the wrong one', async () => {
    const hash = await hashing.hashPassword('password123');

    await expect(hashing.verifyPassword('password123', hash)).resolves.toBe(true);
    await expect(hashing.verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it.each(['', 'not-a-hash', 'scrypt$v2$salt$hash', 'scrypt$v1$$'])(
    'rejects malformed stored hash %j',
    async (stored) => {
      await expect(hashing.verifyPassword('password123', stored)).resolves.toBe(false);
    },
  );

  it('hashes API keys deterministically', () => {
    expect(hashing.hashApiKey('lm_server_test')).toBe(hashing.hashApiKey('lm_server_test'));
    expect(hashing.hashApiKey('lm_server_test')).not.toBe(hashing.hashApiKey('lm_server_other'));
    expect(hashing.hashApiKey('lm_server_test')).toMatch(/^[0-9a-f]{64}$/);
  });
});
