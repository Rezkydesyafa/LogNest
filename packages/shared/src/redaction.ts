export const MASK = '[masked]';

/** Object keys whose value is replaced wholesale, matched as a case-insensitive substring. */
export const SENSITIVE_KEYS = [
  'password',
  'passwd',
  'token',
  'authorization',
  'cookie',
  'secret',
  'apikey',
  'api_key',
  'api-key',
  'credential',
  'privatekey',
  'private_key',
  'session',
];

type Pattern = { name: string; regex: RegExp; replace?: (match: string) => string };

/**
 * Value patterns that leak through free-text log messages, where key-based masking cannot help.
 * Ordered from most specific to least: earlier patterns consume their match first.
 */
const VALUE_PATTERNS: Pattern[] = [
  {
    name: 'private-key-block',
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  },
  {
    // password=hunter2, "token": "abc", api_key: abc, Authorization: Bearer abc.
    // Runs before the standalone patterns so `key: Bearer <token>` is masked in one pass.
    // No leading \b so it still matches inside camelCase names such as clientSecret.
    name: 'inline-secret-assignment',
    regex: new RegExp(
      `(${SENSITIVE_KEYS.join('|')})(["']?)\\s*[:=]\\s*(?!\\[masked\\])(["']?)((?:bearer\\s+|basic\\s+)?[^\\s"',;)}\\]]+)`,
      'gi',
    ),
    replace: (match) => match.replace(/([:=]\s*)(["']?)[\s\S]*$/, `$1$2${MASK}`),
  },
  { name: 'jwt', regex: /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/g },
  { name: 'bearer', regex: /\b(?:bearer|basic)\s+[A-Za-z0-9._~+/-]{8,}={0,2}/gi },
  { name: 'logmind-key', regex: /\blm_(?:server|client)_[A-Za-z0-9_-]{16,}/g },
  { name: 'openai-key', regex: /\bsk-[A-Za-z0-9_-]{16,}/g },
  { name: 'github-token', regex: /\bgh[pousr]_[A-Za-z0-9]{16,}/g },
  { name: 'aws-access-key', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'slack-token', regex: /\bxox[abposr]-[A-Za-z0-9-]{10,}/g },
  {
    // postgres://user:password@host, mongodb+srv://user:password@host, redis://:password@host
    name: 'connection-string-password',
    regex: /\b([a-z][a-z0-9+.-]*:\/\/)([^:@\s/]*):([^@\s/]+)@/gi,
    replace: (match) => match.replace(/:([^@\s/]+)@$/, `:${MASK}@`),
  },
  { name: 'email', regex: /\b[\w.%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { name: 'card-number', regex: /\b(?:\d[ -]?){13,19}\b/g, replace: (match) => (luhn(match) ? MASK : match) },
];

/** Replaces secret-looking substrings inside a free-text log message or stack trace. */
export function redactText(text: string): string {
  if (!text) return text;

  let output = text;
  for (const pattern of VALUE_PATTERNS) {
    output = output.replace(pattern.regex, (match) => (pattern.replace ? pattern.replace(match) : MASK));
  }

  return output;
}

/**
 * Walks an arbitrary structure: masks values under sensitive keys, and redacts secret
 * patterns inside every remaining string.
 */
export function redactDeep(value: unknown, depth = 0): unknown {
  if (depth > 12) return value;
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date) return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      isSensitiveKey(key) ? MASK : redactDeep(child, depth + 1),
    ]),
  );
}

export function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => normalized.includes(sensitive));
}

/** Backwards compatible key-only masking, kept for callers that must not touch string values. */
export function maskSensitiveData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSensitiveData);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      isSensitiveKey(key) ? MASK : maskSensitiveData(child),
    ]),
  );
}

function luhn(candidate: string) {
  const digits = candidate.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }

  return sum % 10 === 0;
}
