import { describe, expect, it } from 'vitest';
import { serviceHealth } from './dashboard-health';

const now = new Date('2026-07-26T12:00:00.000Z');
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

const base = {
  lastSeenAt: minutesAgo(1),
  openIncidentCount: 0,
  criticalIncidentCount: 0,
  logCount: 100,
  errorCount: 0,
  now,
};

describe('serviceHealthStatus', () => {
  it('reports healthy for a fresh service with no errors', () => {
    expect(serviceHealth(base)).toMatchObject({ status: 'healthy', errorRate: 0 });
  });

  it('reports critical whenever a critical incident is open, even when stale', () => {
    expect(serviceHealth({ ...base, criticalIncidentCount: 1 }).status).toBe('critical');
    expect(serviceHealth({ ...base, criticalIncidentCount: 1, lastSeenAt: minutesAgo(120) }).status).toBe(
      'critical',
    );
  });

  it('reports stale after 15 minutes without logs', () => {
    expect(serviceHealth({ ...base, lastSeenAt: minutesAgo(16) }).status).toBe('stale');
    expect(serviceHealth({ ...base, lastSeenAt: minutesAgo(14) }).status).toBe('healthy');
  });

  it('prefers stale over warning for a quiet service with past errors', () => {
    expect(serviceHealth({ ...base, lastSeenAt: minutesAgo(60), errorCount: 3 }).status).toBe('stale');
  });

  it('reports warning for open incidents or recorded errors', () => {
    expect(serviceHealth({ ...base, openIncidentCount: 1 }).status).toBe('warning');
    expect(serviceHealth({ ...base, errorCount: 5 }).status).toBe('warning');
    expect(serviceHealth({ ...base, errorCount: 1 }).status).toBe('healthy');
  });
});
