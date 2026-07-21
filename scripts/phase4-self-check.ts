import { strict as assert } from 'assert';
import { IncidentSeverity } from '@prisma/client';
import { generateFingerprint, normalizeLogMessage, stackTraceHash } from '../packages/shared/src/fingerprint';
import { triggeredIncidentSeverity } from '../packages/shared/src/incident-rules';

assert.equal(
  normalizeLogMessage('Database timeout for user 123 and request 550e8400-e29b-41d4-a716-446655440000'),
  'database timeout for user <number> and request <uuid>',
);

const first = generateFingerprint({
  serviceName: 'payment-service',
  sourceType: 'api',
  level: 'error',
  message: 'Database timeout for user 123',
  api: { path: '/checkout', statusCode: 500 },
});
const second = generateFingerprint({
  serviceName: 'payment-service',
  sourceType: 'api',
  level: 'error',
  message: 'Database timeout for user 456',
  api: { path: '/checkout', statusCode: 500 },
});

assert.equal(first.normalizedMessage, 'database timeout for user <number>');
assert.equal(first.fingerprint, second.fingerprint);
assert.equal(stackTraceHash('Error\n at one\n at two'), stackTraceHash('Error\n at one\n at two'));
assert.equal(triggeredIncidentSeverity(4, 0), null);
assert.equal(triggeredIncidentSeverity(5, 0), IncidentSeverity.HIGH);
assert.equal(triggeredIncidentSeverity(2, 3), IncidentSeverity.CRITICAL);

console.log('phase4 self-check passed');
