export type ServiceHealthStatus = 'healthy' | 'warning' | 'critical' | 'stale';

export function serviceHealthStatus(input: {
  lastSeenAt: Date;
  openIncidentCount: number;
  criticalIncidentCount: number;
  errorCount: number;
  now?: Date;
}): ServiceHealthStatus {
  if (input.criticalIncidentCount > 0) return 'critical';

  const now = input.now ?? new Date();
  const staleAfterMs = 15 * 60 * 1000;
  if (now.getTime() - input.lastSeenAt.getTime() > staleAfterMs) return 'stale';

  if (input.openIncidentCount > 0 || input.errorCount > 0) return 'warning';

  return 'healthy';
}
