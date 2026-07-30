export const DASHBOARD_RANGES = ['15m', '1h', '6h', '24h', '7d'] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

const RANGE_MINUTES: Record<DashboardRange, number> = {
  '15m': 15,
  '1h': 60,
  '6h': 360,
  '24h': 1440,
  '7d': 10080,
};

const BUCKET_MINUTES: Record<DashboardRange, number> = {
  '15m': 1,
  '1h': 5,
  '6h': 15,
  '24h': 60,
  '7d': 360,
};

export function dashboardWindow(range: DashboardRange = '24h', now = new Date()) {
  const durationMs = RANGE_MINUTES[range] * 60_000;
  const from = new Date(now.getTime() - durationMs);

  return {
    range,
    from,
    to: now,
    previousFrom: new Date(from.getTime() - durationMs),
    bucketMinutes: BUCKET_MINUTES[range],
  };
}

export function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
