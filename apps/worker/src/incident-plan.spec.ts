import { AlertTrigger, IncidentEventType, IncidentSeverity, IncidentStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  alertTriggerFor,
  createdIncidentEvent,
  IncidentDetection,
  IncidentSnapshot,
  planIncidentUpdate,
} from './incident-plan';

const at = (iso: string) => new Date(iso);

const existing: IncidentSnapshot = {
  id: 'incident_1',
  severity: IncidentSeverity.HIGH,
  status: IncidentStatus.OPEN,
  firstSeenAt: at('2026-07-26T10:00:00.000Z'),
  lastSeenAt: at('2026-07-26T10:05:00.000Z'),
};

const detection: IncidentDetection = {
  projectId: 'project_1',
  serviceId: 'service_1',
  fingerprint: 'fp_1',
  rawLogId: 'raw_2',
  title: 'database timeout',
  severity: IncidentSeverity.HIGH,
  recentCount: 7,
  timestamp: at('2026-07-26T10:06:00.000Z'),
};

describe('planIncidentUpdate', () => {
  it('increments the lifetime total instead of overwriting it', () => {
    const { update } = planIncidentUpdate(existing, detection);

    expect(update.occurrenceCount).toEqual({ increment: 1 });
    expect(update.recentCount).toBe(7);
  });

  it('records no event for a plain repeat occurrence', () => {
    expect(planIncidentUpdate(existing, detection).event).toBeUndefined();
  });

  it('moves lastSeenAt forward for a newer log', () => {
    expect(planIncidentUpdate(existing, detection).update.lastSeenAt).toEqual(detection.timestamp);
  });

  it('never moves lastSeenAt backwards for an out-of-order log', () => {
    const { update } = planIncidentUpdate(existing, {
      ...detection,
      timestamp: at('2026-07-26T10:02:00.000Z'),
    });

    expect(update.lastSeenAt).toBeUndefined();
    expect(update.firstSeenAt).toBeUndefined();
  });

  it('extends firstSeenAt when a log older than the incident arrives', () => {
    const older = at('2026-07-26T09:30:00.000Z');
    const { update } = planIncidentUpdate(existing, { ...detection, timestamp: older });

    expect(update.firstSeenAt).toEqual(older);
    expect(update.lastSeenAt).toBeUndefined();
  });

  it('reopens a resolved incident and logs a status change', () => {
    const { update, event } = planIncidentUpdate({ ...existing, status: IncidentStatus.RESOLVED }, detection);

    expect(update.status).toBe(IncidentStatus.OPEN);
    expect(update.resolvedAt).toBeNull();
    expect(event?.type).toBe(IncidentEventType.STATUS_CHANGED);
    expect(event?.message).toMatch(/reopened/);
  });

  it('logs a severity change with both levels', () => {
    const { update, event } = planIncidentUpdate(existing, {
      ...detection,
      severity: IncidentSeverity.CRITICAL,
    });

    expect(update.severity).toBe(IncidentSeverity.CRITICAL);
    expect(event?.type).toBe(IncidentEventType.UPDATED);
    expect(event?.message).toBe('Severity changed from high to critical');
  });

  it('prefers the reopen event over the severity event', () => {
    const { event } = planIncidentUpdate(
      { ...existing, status: IncidentStatus.RESOLVED },
      { ...detection, severity: IncidentSeverity.CRITICAL },
    );

    expect(event?.type).toBe(IncidentEventType.STATUS_CHANGED);
  });

  it('always refreshes the title and the last raw log pointer', () => {
    const { update } = planIncidentUpdate(existing, { ...detection, title: 'new title' });

    expect(update.title).toBe('new title');
    expect(update.lastRawLogId).toBe('raw_2');
  });
});

describe('alertTriggerFor', () => {
  it('raises CREATED for a brand new incident', () => {
    expect(alertTriggerFor(undefined, detection)).toBe(AlertTrigger.CREATED);
    expect(alertTriggerFor(null, detection)).toBe(AlertTrigger.CREATED);
  });

  it('raises REOPENED when a resolved incident comes back', () => {
    expect(alertTriggerFor({ ...existing, status: IncidentStatus.RESOLVED }, detection)).toBe(
      AlertTrigger.REOPENED,
    );
  });

  it('raises SEVERITY_INCREASED only when severity moves up', () => {
    expect(alertTriggerFor(existing, { ...detection, severity: IncidentSeverity.CRITICAL })).toBe(
      AlertTrigger.SEVERITY_INCREASED,
    );
    expect(
      alertTriggerFor(
        { ...existing, severity: IncidentSeverity.CRITICAL },
        { ...detection, severity: IncidentSeverity.HIGH },
      ),
    ).toBeUndefined();
  });

  it('stays quiet for a plain repeat occurrence so a loud incident alerts once', () => {
    expect(alertTriggerFor(existing, detection)).toBeUndefined();
  });
});

describe('createdIncidentEvent', () => {
  it('describes the severity the incident opened at', () => {
    const event = createdIncidentEvent(detection);

    expect(event.type).toBe(IncidentEventType.CREATED);
    expect(event.message).toBe('Incident created with high severity');
    expect(event.metadata).toEqual({ recentCount: 7, rawLogId: 'raw_2' });
  });
});
