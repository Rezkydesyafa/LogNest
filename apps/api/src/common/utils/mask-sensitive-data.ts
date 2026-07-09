const SENSITIVE_KEYS = ['password', 'token', 'authorization', 'cookie', 'secret'];

export function maskSensitiveData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(maskSensitiveData);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      SENSITIVE_KEYS.some((sensitiveKey) => key.toLowerCase().includes(sensitiveKey))
        ? '[masked]'
        : maskSensitiveData(child),
    ]),
  );
}
