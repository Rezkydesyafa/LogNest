import { strict as assert } from 'assert';
import { serviceHealthStatus } from '../apps/api/src/modules/dashboard/dashboard-health';

const now = new Date('2026-07-09T10:00:00.000Z');

assert.equal(
  serviceHealthStatus({
    lastSeenAt: new Date('2026-07-09T09:59:00.000Z'),
    openIncidentCount: 0,
    criticalIncidentCount: 0,
    errorCount: 0,
    now,
  }),
  'healthy',
);
assert.equal(
  serviceHealthStatus({
    lastSeenAt: new Date('2026-07-09T09:59:00.000Z'),
    openIncidentCount: 1,
    criticalIncidentCount: 0,
    errorCount: 0,
    now,
  }),
  'warning',
);
assert.equal(
  serviceHealthStatus({
    lastSeenAt: new Date('2026-07-09T09:59:00.000Z'),
    openIncidentCount: 1,
    criticalIncidentCount: 1,
    errorCount: 0,
    now,
  }),
  'critical',
);
assert.equal(
  serviceHealthStatus({
    lastSeenAt: new Date('2026-07-09T09:40:00.000Z'),
    openIncidentCount: 0,
    criticalIncidentCount: 0,
    errorCount: 0,
    now,
  }),
  'stale',
);

console.log('phase6 self-check passed');
