// Week-boundary helpers, anchored to Asia/Singapore (UTC+8, no DST), matching
// the rest of the app's day logic. A "week" starts Monday 00:00 SGT.

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000; // Singapore is UTC+8 year-round

/**
 * The start of the current week (Monday 00:00:00 Singapore time) as a Date
 * (an absolute instant; its .toISOString() is the UTC equivalent).
 */
export function currentWeekStart(now: Date = new Date()): Date {
  // Shift "now" into SGT wall-clock space so we can read the SGT weekday/time.
  const sgtNow = new Date(now.getTime() + SGT_OFFSET_MS);

  // getUTC* on the shifted value reflects SGT wall-clock fields.
  const dow = sgtNow.getUTCDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const daysSinceMonday = (dow + 6) % 7; // Mon->0, Tue->1, ... Sun->6

  // Midnight SGT of today, in SGT wall-clock space.
  const sgtMidnightToday = Date.UTC(
    sgtNow.getUTCFullYear(),
    sgtNow.getUTCMonth(),
    sgtNow.getUTCDate()
  );
  // Back up to Monday, then convert SGT wall-clock back to a real UTC instant.
  const sgtMonday = sgtMidnightToday - daysSinceMonday * 24 * 60 * 60 * 1000;
  return new Date(sgtMonday - SGT_OFFSET_MS);
}

/** The start of the previous week (Monday 00:00 SGT). */
export function previousWeekStart(now: Date = new Date()): Date {
  const thisWeek = currentWeekStart(now);
  return new Date(thisWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
}

/**
 * Returns the boundary instants (as ISO strings) for the current and previous
 * weeks: [prevWeekStart, thisWeekStart, nextWeekStart).
 * - current week  = [thisWeekStartISO, nextWeekStartISO)
 * - previous week = [prevWeekStartISO, thisWeekStartISO)
 */
export function weekBoundaries(now: Date = new Date()): {
  prevWeekStartISO: string;
  thisWeekStartISO: string;
  nextWeekStartISO: string;
} {
  const thisWeek = currentWeekStart(now);
  const prevWeek = new Date(thisWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
  const nextWeek = new Date(thisWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    prevWeekStartISO: prevWeek.toISOString(),
    thisWeekStartISO: thisWeek.toISOString(),
    nextWeekStartISO: nextWeek.toISOString(),
  };
}
