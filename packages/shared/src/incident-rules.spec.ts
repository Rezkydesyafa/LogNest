import { IncidentSeverity } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { severityForCounts, triggeredIncidentSeverity } from './incident-rules';

describe('severityForCounts', () => {
  it.each([
    [0, 0, null],
    [1, 0, IncidentSeverity.LOW],
    [2, 0, IncidentSeverity.LOW],
    [3, 0, IncidentSeverity.MEDIUM],
    [4, 0, IncidentSeverity.MEDIUM],
    [5, 0, IncidentSeverity.HIGH],
    [50, 0, IncidentSeverity.HIGH],
  ])('classifies %i errors in 10m as %s', (count10m, fatalCount5m, expected) => {
    expect(severityForCounts(count10m, fatalCount5m)).toBe(expected);
  });

  it('escalates to critical on repeated fatal errors regardless of the 10m count', () => {
    expect(severityForCounts(1, 3)).toBe(IncidentSeverity.CRITICAL);
    expect(severityForCounts(100, 3)).toBe(IncidentSeverity.CRITICAL);
    expect(severityForCounts(1, 2)).toBe(IncidentSeverity.LOW);
  });
});

describe('triggeredIncidentSeverity', () => {
  it('does not open an incident below the threshold', () => {
    expect(triggeredIncidentSeverity(1, 0)).toBeNull();
    expect(triggeredIncidentSeverity(4, 0)).toBeNull();
    expect(triggeredIncidentSeverity(4, 2)).toBeNull();
  });

  it('opens a high incident at 5 errors in 10 minutes', () => {
    expect(triggeredIncidentSeverity(5, 0)).toBe(IncidentSeverity.HIGH);
  });

  it('opens a critical incident at 3 fatal errors in 5 minutes', () => {
    expect(triggeredIncidentSeverity(1, 3)).toBe(IncidentSeverity.CRITICAL);
  });

  it('prefers critical over high when both thresholds are met', () => {
    expect(triggeredIncidentSeverity(20, 5)).toBe(IncidentSeverity.CRITICAL);
  });
});
