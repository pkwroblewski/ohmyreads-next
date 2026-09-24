const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `YYYY-MM-DD` from the date's LOCAL calendar day. `toISOString()` would use
 * the UTC day, which is the previous day east of UTC at local midnight.
 */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Timing of a challenge whose start/end are Postgres DATE strings. The end
 * date is inclusive: books finished at any time on it count. We don't know
 * the user's timezone, so the window uses UTC days and the challenge only
 * counts as over once the day after `end` has passed (UTC), so it is never
 * failed while the end date is still today anywhere.
 */
export function challengeWindow(startDate: string, endDate: string, now: Date) {
  const start = Date.parse(startDate);
  const endExclusive = Date.parse(endDate) + DAY_MS;
  const nowMs = now.getTime();
  const totalDays = Math.round((endExclusive - start) / DAY_MS);
  const daysRemaining = Math.max(
    0,
    Math.ceil((endExclusive - nowMs) / DAY_MS)
  );
  return {
    contains: (instant: string) => {
      const t = Date.parse(instant);
      return t >= start && t < endExclusive;
    },
    totalDays,
    daysRemaining,
    daysElapsed: Math.max(0, totalDays - daysRemaining),
    isOver: nowMs >= endExclusive + DAY_MS,
  };
}
