import { describe, expect, it } from 'vitest';
import { serviceHealthStatus } from './dashboard-health';

const now = new Date('2026-07-26T12:00:00.000Z');
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

const base = {
  lastSeenAt: minutesAgo(1),
  openIncidentCount: 0,
  criticalIncidentCount: 0,
  errorCount: 0,
  now,
};

describe('serviceHealthStatus', () => {
  it('reports healthy for a fresh service with no errors', () => {
    expect(serviceHealthStatus(base)).toBe('healthy');
  });

  it('reports critical whenever a critical incident is open, even when stale', () => {
    expect(serviceHealthStatus({ ...base, criticalIncidentCount: 1 })).toBe('critical');
    expect(serviceHealthStatus({ ...base, criticalIncidentCount: 1, lastSeenAt: minutesAgo(120) })).toBe(
      'critical',
    );
  });

  it('reports stale after 15 minutes without logs', () => {
    expect(serviceHealthStatus({ ...base, lastSeenAt: minutesAgo(16) })).toBe('stale');
    expect(serviceHealthStatus({ ...base, lastSeenAt: minutesAgo(14) })).toBe('healthy');
  });

  it('prefers stale over warning for a quiet service with past errors', () => {
    expect(serviceHealthStatus({ ...base, lastSeenAt: minutesAgo(60), errorCount: 3 })).toBe('stale');
  });

  it('reports warning for open incidents or recorded errors', () => {
    expect(serviceHealthStatus({ ...base, openIncidentCount: 1 })).toBe('warning');
    expect(serviceHealthStatus({ ...base, errorCount: 1 })).toBe('warning');
  });
});
