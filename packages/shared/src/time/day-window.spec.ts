import { describe, expect, it } from 'vitest';
import { isValidTimeZone, startOfDayIn } from './day-window';

describe('isValidTimeZone', () => {
  it.each(['UTC', 'Asia/Jakarta', 'America/New_York'])('accepts %s', (zone) => {
    expect(isValidTimeZone(zone)).toBe(true);
  });

  it.each(['', 'Mars/Olympus', 'not a zone'])('rejects %j', (zone) => {
    expect(isValidTimeZone(zone)).toBe(false);
  });
});

describe('startOfDayIn', () => {
  it('returns UTC midnight for UTC', () => {
    const start = startOfDayIn('UTC', new Date('2026-07-26T15:30:00.000Z'));

    expect(start.toISOString()).toBe('2026-07-26T00:00:00.000Z');
  });

  it('starts the Jakarta day at 17:00 UTC the day before', () => {
    // 2026-07-26T15:30Z is 22:30 on the 26th in Jakarta (UTC+7).
    const start = startOfDayIn('Asia/Jakarta', new Date('2026-07-26T15:30:00.000Z'));

    expect(start.toISOString()).toBe('2026-07-25T17:00:00.000Z');
  });

  it('puts an instant just after local midnight into the new day, not the old one', () => {
    // 2026-07-26T17:30Z is 00:30 on the 27th in Jakarta.
    const start = startOfDayIn('Asia/Jakarta', new Date('2026-07-26T17:30:00.000Z'));

    expect(start.toISOString()).toBe('2026-07-26T17:00:00.000Z');
  });

  it('handles zones west of Greenwich', () => {
    // 2026-07-26T02:00Z is 22:00 on the 25th in New York (UTC-4 in July).
    const start = startOfDayIn('America/New_York', new Date('2026-07-26T02:00:00.000Z'));

    expect(start.toISOString()).toBe('2026-07-25T04:00:00.000Z');
  });

  it('handles a half-hour offset zone', () => {
    // India is UTC+5:30, so its day starts at 18:30 UTC the day before.
    const start = startOfDayIn('Asia/Kolkata', new Date('2026-07-26T15:30:00.000Z'));

    expect(start.toISOString()).toBe('2026-07-25T18:30:00.000Z');
  });

  it('accounts for daylight saving rather than assuming a fixed offset', () => {
    const winter = startOfDayIn('Europe/Berlin', new Date('2026-01-15T12:00:00.000Z'));
    const summer = startOfDayIn('Europe/Berlin', new Date('2026-07-15T12:00:00.000Z'));

    expect(winter.toISOString()).toBe('2026-01-14T23:00:00.000Z');
    expect(summer.toISOString()).toBe('2026-07-14T22:00:00.000Z');
  });

  it('falls back to UTC for an unknown zone instead of throwing', () => {
    const start = startOfDayIn('Mars/Olympus', new Date('2026-07-26T15:30:00.000Z'));

    expect(start.toISOString()).toBe('2026-07-26T00:00:00.000Z');
  });

  it('never returns an instant in the future', () => {
    const now = new Date('2026-07-26T15:30:00.000Z');

    for (const zone of ['UTC', 'Asia/Jakarta', 'America/New_York', 'Pacific/Auckland']) {
      expect(startOfDayIn(zone, now).getTime()).toBeLessThanOrEqual(now.getTime());
    }
  });
});
