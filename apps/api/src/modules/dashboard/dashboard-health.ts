export type ServiceHealthStatus = 'healthy' | 'warning' | 'critical' | 'stale';

export function serviceHealth(input: {
  lastSeenAt: Date;
  openIncidentCount: number;
  criticalIncidentCount: number;
  logCount: number;
  errorCount: number;
  now?: Date;
}): { status: ServiceHealthStatus; reason: string; errorRate: number } {
  const errorRate = input.logCount ? Math.round((input.errorCount / input.logCount) * 1000) / 10 : 0;
  if (input.criticalIncidentCount > 0) {
    return {
      status: 'critical',
      reason: `${input.criticalIncidentCount} open critical incident${input.criticalIncidentCount === 1 ? '' : 's'}`,
      errorRate,
    };
  }

  const now = input.now ?? new Date();
  const inactiveMinutes = Math.floor((now.getTime() - input.lastSeenAt.getTime()) / 60_000);
  if (inactiveMinutes > 15) {
    return {
      status: 'stale',
      reason: `No logs received for ${inactiveMinutes} minutes`,
      errorRate,
    };
  }

  if (input.errorCount > 0 && errorRate >= 5) {
    return { status: 'warning', reason: `${errorRate}% error rate in this range`, errorRate };
  }
  if (input.openIncidentCount > 0) {
    return {
      status: 'warning',
      reason: `${input.openIncidentCount} open incident${input.openIncidentCount === 1 ? '' : 's'}`,
      errorRate,
    };
  }

  return { status: 'healthy', reason: 'Receiving logs normally', errorRate };
}
