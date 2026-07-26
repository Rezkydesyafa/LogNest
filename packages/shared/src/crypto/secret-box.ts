import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const VERSION = 'v1';

/** Shape stored in the database when a key is configured. */
export type SealedValue = { $enc: string };

export function isSealed(value: unknown): value is SealedValue {
  return Boolean(value && typeof value === 'object' && typeof (value as SealedValue).$enc === 'string');
}

/**
 * Parses the configured encryption key.
 *
 * Accepts 32 bytes as hex or base64. Returns undefined when unset, so a deployment that has
 * not configured a key keeps working with plaintext instead of failing to boot.
 */
export function resolveEncryptionKey(raw?: string): Buffer | undefined {
  if (!raw) return undefined;

  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');

  if (key.length !== 32) {
    throw new Error('ALERT_ENCRYPTION_KEY must be 32 bytes, as 64 hex characters or base64');
  }

  return key;
}

/**
 * Encrypts an arbitrary JSON value with AES-256-GCM.
 *
 * The whole object is sealed rather than individual fields: which keys are secret depends
 * on the channel type, and a per-field rule would silently miss a new one.
 */
export function seal(value: unknown, key: Buffer): SealedValue {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);

  return {
    $enc: [
      VERSION,
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.'),
  };
}

export function open<T>(value: SealedValue, key: Buffer): T {
  const [version, iv, tag, ciphertext] = value.$enc.split('.');

  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error('Encrypted value is malformed');
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');

  return JSON.parse(plaintext) as T;
}

/**
 * Reads a value that may or may not be encrypted.
 *
 * Rows written before a key was configured stay readable, so enabling encryption does not
 * require a data migration.
 */
export function openMaybeSealed<T>(value: unknown, key?: Buffer): T {
  if (!isSealed(value)) return value as T;

  if (!key) {
    throw new Error('Value is encrypted but ALERT_ENCRYPTION_KEY is not configured');
  }

  return open<T>(value, key);
}

/** Encrypts when a key is available, and passes the value through untouched when it is not. */
export function sealIfPossible(value: unknown, key?: Buffer) {
  return key ? seal(value, key) : value;
}
