import { describe, expect, it } from 'vitest';
import { dashboardWindow, percentChange } from './dashboard-range';

describe('dashboard ranges', () => {
  it('builds comparable windows and stable trends', () => {
    const now = new Date('2026-07-30T12:00:00.000Z');
    const window = dashboardWindow('1h', now);

    expect(window).toMatchObject({ range: '1h', bucketMinutes: 5, to: now });
    expect(window.from.toISOString()).toBe('2026-07-30T11:00:00.000Z');
    expect(window.previousFrom.toISOString()).toBe('2026-07-30T10:00:00.000Z');
    expect(percentChange(15, 10)).toBe(50);
    expect(percentChange(1, 0)).toBeNull();
  });
});
