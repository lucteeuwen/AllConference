import { CONFERENCE_TZ, TODAY_KEY, dayKeyForOffset } from "@/lib/data/season";

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

export function formatKickoff(iso: string): string {
  return timeFormat.format(new Date(iso));
}

export function formatDayHeading(iso: string): string {
  return headingFormat.format(new Date(iso));
}

export function formatShortDate(iso: string): string {
  return shortFormat.format(new Date(iso));
}

export function formatFullDate(iso: string): string {
  return fullFormat.format(new Date(iso));
}

const YESTERDAY_KEY = dayKeyForOffset(-1);
const TOMORROW_KEY = dayKeyForOffset(1);

/** Heading above a day's fixtures: "Today" reads better than the date. */
export function formatDayLabel(key: string): string {
  if (key === TODAY_KEY) return "Today";
  if (key === YESTERDAY_KEY) return "Yesterday";
  if (key === TOMORROW_KEY) return "Tomorrow";
  return headingFormat.format(instantForDayKey(key));
}

/** Two-line label for the date strip chips. */
export function formatChipLabel(key: string): { top: string; bottom: string } {
  const instant = instantForDayKey(key);
  if (key === TODAY_KEY) return { top: "Today", bottom: shortFormat.format(instant) };
  if (key === YESTERDAY_KEY) return { top: "Yesterday", bottom: shortFormat.format(instant) };
  if (key === TOMORROW_KEY) return { top: "Tomorrow", bottom: shortFormat.format(instant) };
  return {
    top: weekdayFormat.format(instant),
    bottom: `${shortFormat.format(instant).split(" ")[0]} ${dayNumberFormat.format(instant)}`,
  };
}

export function isPastDay(key: string): boolean {
  return key < TODAY_KEY;
}

export { TODAY_KEY };
