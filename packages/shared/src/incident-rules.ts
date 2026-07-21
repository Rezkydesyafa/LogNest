import { IncidentSeverity } from '@prisma/client';

export function triggeredIncidentSeverity(count10m: number, fatalCount5m: number) {
  if (fatalCount5m >= 3) return IncidentSeverity.CRITICAL;
  if (count10m >= 5) return IncidentSeverity.HIGH;
  return null;
}
