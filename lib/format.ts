import { CONFERENCE_TZ, todayKey } from "@/lib/season";

/**
 * Every formatter pins the time zone to Central so the server-rendered string
 * and the browser's re-render always match, whatever the viewer's own zone is.
 */

function formatter(options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { timeZone: CONFERENCE_TZ, ...options });
}

const timeFormat = formatter({ hour: "numeric", minute: "2-digit" });
const headingFormat = formatter({ weekday: "long", month: "long", day: "numeric" });
const shortFormat = formatter({ month: "short", day: "numeric" });
const weekdayFormat = formatter({ weekday: "short" });
const dayNumberFormat = formatter({ day: "numeric" });
const fullFormat = formatter({
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** A day key is a bare calendar date; noon UTC lands on the same Central day. */
function instantForDayKey(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}

const clockFormat = formatter({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/**
 * Games whose time is not set yet (tournament rounds) are stored at Central
 * midnight; nothing kicks off then, so that reads as "to be announced".
 */
export function isTimeTba(iso: string): boolean {
  return clockFormat.format(new Date(iso)) === "00:00";
}

export function formatKickoff(iso: string): string {
  return isTimeTba(iso) ? "TBA" : timeFormat.format(new Date(iso));
}

export function formatDayHeading(iso: string): string {
  return headingFormat.format(new Date(iso));
}

export function formatShortDate(iso: string): string {
  return shortFormat.format(new Date(iso));
}

export function formatFullDate(iso: string): string {
  return isTimeTba(iso) ? `${headingFormat.format(new Date(iso))} · time TBA` : fullFormat.format(new Date(iso));
}

/** "Today", "Yesterday" or "Tomorrow" when the key is one of those. */
function relativeDay(key: string): string | null {
  if (key === todayKey()) return "Today";
  if (key === todayKey(-1)) return "Yesterday";
  if (key === todayKey(1)) return "Tomorrow";
  return null;
}

/** Heading above a day's fixtures: "Today" reads better than the date. */
export function formatDayLabel(key: string): string {
  return relativeDay(key) ?? headingFormat.format(instantForDayKey(key));
}

/** Two-line label for the date strip chips. */
export function formatChipLabel(key: string): { top: string; bottom: string } {
  const instant = instantForDayKey(key);
  const relative = relativeDay(key);
  if (relative) return { top: relative, bottom: shortFormat.format(instant) };
  return {
    top: weekdayFormat.format(instant),
    bottom: `${shortFormat.format(instant).split(" ")[0]} ${dayNumberFormat.format(instant)}`,
  };
}

export function isPastDay(key: string): boolean {
  return key < todayKey();
}
