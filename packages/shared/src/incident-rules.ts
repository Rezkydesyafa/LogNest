import { IncidentSeverity } from '@prisma/client';

/** Errors with the same fingerprint needed inside the 10 minute window to open an incident. */
export const INCIDENT_THRESHOLD_10M = 5;
/** Fatal errors with the same fingerprint needed inside the 5 minute window to escalate to critical. */
export const FATAL_THRESHOLD_5M = 3;

/**
 * Full severity classification from the PRD. Used to keep the severity of an existing
 * incident up to date, including downgrades once the burst calms down.
 */
export function severityForCounts(count10m: number, fatalCount5m: number) {
  if (fatalCount5m >= FATAL_THRESHOLD_5M) return IncidentSeverity.CRITICAL;
  if (count10m >= INCIDENT_THRESHOLD_10M) return IncidentSeverity.HIGH;
  if (count10m >= 3) return IncidentSeverity.MEDIUM;
  if (count10m >= 1) return IncidentSeverity.LOW;
  return null;
}

/**
 * Severity that is allowed to *open* a new incident. Low and medium bursts are tracked
 * but never create an incident on their own, so the incident list stays actionable.
 */
export function triggeredIncidentSeverity(count10m: number, fatalCount5m: number) {
  if (fatalCount5m >= FATAL_THRESHOLD_5M) return IncidentSeverity.CRITICAL;
  if (count10m >= INCIDENT_THRESHOLD_10M) return IncidentSeverity.HIGH;
  return null;
}
