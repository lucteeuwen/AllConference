/**
 * Season timing helpers.
 *
 * The dummy schedule is generated relative to the current date so the demo
 * always shows a realistic mix of finished results, a live match and upcoming
 * fixtures. Every kickoff is stored as a UTC instant and every format call
 * pins the zone to Central, so the server and the browser agree regardless of
 * where either one is running.
 */

export const CONFERENCE_TZ = "America/Chicago";
export const SEASON_LABEL = "2026 Season";

function zoneOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CONFERENCE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);

  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  const asUtc = Date.UTC(
    lookup("year"),
    lookup("month") - 1,
    lookup("day"),
    lookup("hour") % 24,
    lookup("minute"),
    lookup("second"),
  );

  return (asUtc - instant.getTime()) / 60000;
}

/** The UTC instant at which the Central-time wall clock reads the given values. */
function centralInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const offset = zoneOffsetMinutes(new Date(naive));
  return new Date(naive - offset * 60000);
}

/** Today's calendar date in Central time. */
function centralToday(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CONFERENCE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [year, month, day] = parts.split("-").map(Number);
  return { year, month, day };
}

const today = centralToday();

/** ISO instant for a kickoff `dayOffset` days from today at the given local time. */
export function kickoff(dayOffset: number, hour: number, minute = 0): string {
  return centralInstant(today.year, today.month, today.day + dayOffset, hour, minute).toISOString();
}

/** Calendar day key (YYYY-MM-DD in Central) used to group and filter matches. */
export function dayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CONFERENCE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Day key for today, and for a given offset from today. */
export function dayKeyForOffset(dayOffset: number): string {
  return dayKey(kickoff(dayOffset, 12));
}

export const TODAY_KEY = dayKeyForOffset(0);
