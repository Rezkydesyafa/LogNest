export const DEFAULT_MASK_FIELDS = ['password', 'token', 'authorization', 'cookie', 'secret'];

export function maskSensitiveData(value: unknown, fields = DEFAULT_MASK_FIELDS): unknown {
  if (Array.isArray(value)) return value.map((item) => maskSensitiveData(item, fields));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      fields.some((field) => key.toLowerCase().includes(field.toLowerCase()))
        ? '[masked]'
        : maskSensitiveData(child, fields),
    ]),
  );
}
