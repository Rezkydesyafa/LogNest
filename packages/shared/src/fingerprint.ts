import { createHash } from 'crypto';

export type FingerprintInput = {
  serviceName: string;
  sourceType: string;
  level: string;
  message: string;
  stackTrace?: string;
  api?: Record<string, unknown>;
};

export function normalizeLogMessage(message: string) {
  return message
    .toLowerCase()
    .replace(/[a-f0-9]{24}/g, '<object_id>')
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/g, '<uuid>')
    .replace(/\b\d+\b/g, '<number>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stackTraceHash(stackTrace?: string) {
  if (!stackTrace) return undefined;
  const firstFrames = stackTrace.split('\n').slice(0, 5).join('\n');
  return createHash('sha1').update(firstFrames).digest('hex').slice(0, 12);
}

export function generateFingerprint(input: FingerprintInput) {
  const normalizedMessage = normalizeLogMessage(input.message);
  const statusCode = input.api?.statusCode ? String(input.api.statusCode) : '';
  const path = typeof input.api?.path === 'string' ? input.api.path : '';
  const stackHash = stackTraceHash(input.stackTrace) ?? '';
  const base = [
    input.serviceName,
    input.sourceType,
    input.level,
    path,
    statusCode,
    normalizedMessage,
    stackHash,
  ].join('|');

  return {
    normalizedMessage,
    fingerprint: createHash('sha1').update(base).digest('hex'),
    stackTraceHash: stackHash || undefined,
  };
}
