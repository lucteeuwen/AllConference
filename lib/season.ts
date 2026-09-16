/**
 * Season and clock helpers. Every kickoff is stored as a UTC instant and every
 * format call pins the zone to Central, so the server and the browser agree
 * regardless of where either one is running.
 */

export const CONFERENCE_TZ = "America/Chicago";
export const SEASON = Number(process.env.NEXT_PUBLIC_SEASON ?? 2026);
export const SEASON_LABEL = `${SEASON} Season`;

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: CONFERENCE_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar day key (YYYY-MM-DD in Central) used to group and filter matches. */
export function dayKey(iso: string | Date): string {
  return dayFormat.format(typeof iso === "string" ? new Date(iso) : iso);
}

/** Day key for today, or `offset` days from today, read at call time. */
export function todayKey(offset = 0, now = new Date()): string {
  return dayKey(new Date(now.getTime() + offset * 86_400_000));
}
