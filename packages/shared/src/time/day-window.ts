/**
 * Instant at which the current day started in `timeZone`.
 *
 * `new Date().setHours(0,0,0,0)` uses the *server's* timezone, which makes "today" start at
 * the wrong moment for every team not colocated with the server. This resolves the boundary
 * in the project's own zone and returns it as a real UTC instant, which is what the
 * timestamp filters compare against.
 */
export function startOfDayIn(timeZone: string, now = new Date()): Date {
  const zone = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const offsetMs = zoneOffsetMs(zone, now);
  // Shift into the zone, truncate the clock, then shift back to a UTC instant.
  const local = new Date(now.getTime() + offsetMs);
  const midnightLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 0, 0, 0, 0);

  return new Date(midnightLocal - offsetMs);
}

export function isValidTimeZone(timeZone: string) {
  if (!timeZone) return false;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

/**
 * Offset of `timeZone` from UTC at `at`, in milliseconds. Positive east of Greenwich.
 * Derived from Intl so daylight saving is handled without a timezone database dependency.
 */
function zoneOffsetMs(timeZone: string, at: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const field = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  // Intl renders midnight as hour 24 in some environments; Date.UTC normalises it.
  const asUtc = Date.UTC(
    field('year'),
    field('month') - 1,
    field('day'),
    field('hour'),
    field('minute'),
    field('second'),
  );

  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}
