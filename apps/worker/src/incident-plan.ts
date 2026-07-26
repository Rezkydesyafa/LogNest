import { AlertTrigger, IncidentEventType, IncidentSeverity, IncidentStatus, Prisma } from '@prisma/client';
import { isSeverityIncrease } from '../../../packages/shared/src';

export type IncidentSnapshot = {
  id: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

export type IncidentDetection = {
  projectId: string;
  serviceId: string;
  fingerprint: string;
  rawLogId: string;
  title: string;
  severity: IncidentSeverity;
  recentCount: number;
  timestamp: Date;
};

export type IncidentUpdateData = {
  title: string;
  severity: IncidentSeverity;
  recentCount: number;
  occurrenceCount: { increment: number };
  lastRawLogId: string;
  lastSeenAt?: Date;
  firstSeenAt?: Date;
  status?: IncidentStatus;
  resolvedAt?: null;
};

export type IncidentEventPlan = {
  type: IncidentEventType;
  message: string;
  metadata: Prisma.InputJsonObject;
};

export type IncidentPlan = {
  update: IncidentUpdateData;
  event?: IncidentEventPlan;
};

/**
 * Decides how an existing incident should change for one newly detected occurrence.
 *
 * Two rules matter here:
 *  - `occurrenceCount` only ever increments, so it stays a lifetime total; the rolling
 *    detection window lives in `recentCount`.
 *  - an event is only recorded when something an operator would care about changed,
 *    otherwise every error log after the threshold would append a row forever.
 */
export function planIncidentUpdate(existing: IncidentSnapshot, input: IncidentDetection): IncidentPlan {
  const reopened = existing.status === IncidentStatus.RESOLVED;
  const severityChanged = existing.severity !== input.severity;
  const update: IncidentUpdateData = {
    title: input.title,
    severity: input.severity,
    recentCount: input.recentCount,
    occurrenceCount: { increment: 1 },
    lastRawLogId: input.rawLogId,
  };

  // Logs can arrive out of order after a retry, so never move the window backwards.
  if (input.timestamp > existing.lastSeenAt) update.lastSeenAt = input.timestamp;
  if (input.timestamp < existing.firstSeenAt) update.firstSeenAt = input.timestamp;

  if (reopened) {
    update.status = IncidentStatus.OPEN;
    update.resolvedAt = null;

    return {
      update,
      event: {
        type: IncidentEventType.STATUS_CHANGED,
        message: 'Incident reopened after the fingerprint threshold was reached again',
        metadata: { recentCount: input.recentCount, rawLogId: input.rawLogId },
      },
    };
  }

  if (severityChanged) {
    return {
      update,
      event: {
        type: IncidentEventType.UPDATED,
        message: `Severity changed from ${existing.severity.toLowerCase()} to ${input.severity.toLowerCase()}`,
        metadata: { recentCount: input.recentCount, rawLogId: input.rawLogId },
      },
    };
  }

  return { update };
}

/**
 * Which alert this detection should raise, if any. Returns undefined for a plain repeat
 * occurrence so a loud incident does not alert on every single log line.
 */
export function alertTriggerFor(
  existing: IncidentSnapshot | null | undefined,
  input: IncidentDetection,
): AlertTrigger | undefined {
  if (!existing) return AlertTrigger.CREATED;
  if (existing.status === IncidentStatus.RESOLVED) return AlertTrigger.REOPENED;
  if (isSeverityIncrease(existing.severity, input.severity)) return AlertTrigger.SEVERITY_INCREASED;
  return undefined;
}

export function createdIncidentEvent(input: IncidentDetection): IncidentEventPlan {
  return {
    type: IncidentEventType.CREATED,
    message: `Incident created with ${input.severity.toLowerCase()} severity`,
    metadata: { recentCount: input.recentCount, rawLogId: input.rawLogId },
  };
}
