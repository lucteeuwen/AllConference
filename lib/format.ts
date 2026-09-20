import { FALLBACK_TZ, isValidTimeZone } from "@/lib/timezone";
import type { Match } from "@/lib/types";

/**
 * Every kickoff is a UTC instant, and every formatter here takes the zone to
 * render it in. The server passes the fallback zone and the browser passes the
 * reader's own, which is what makes a time read correctly wherever it is read.
 *
 * Two families live here and they must not be mixed up:
 *   - instant formatters take an ISO instant and a zone;
 *   - day-key formatters take a bare "YYYY-MM-DD" that is *already* in the
 *     reader's zone, so they render it in UTC and take no zone at all.
 * Formatting a day key in a named zone is how you get the wrong weekday for a
 * reader east of the date line.
 */

type Style =
  | "time" | "short" | "weekday" | "dayNumber" | "heading" | "full" | "zone" | "zoneGb" | "dayKey";

const OPTIONS: Record<Style, Intl.DateTimeFormatOptions> = {
  time: { hour: "numeric", minute: "2-digit" },
  short: { month: "short", day: "numeric" },
  weekday: { weekday: "short" },
  dayNumber: { day: "numeric" },
  heading: { weekday: "long", month: "long", day: "numeric" },
  full: { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" },
  zone: { timeZoneName: "short" },
  zoneGb: { timeZoneName: "short" },
  dayKey: { year: "numeric", month: "2-digit", day: "2-digit" },
};

const LOCALE: Partial<Record<Style, string>> = { dayKey: "en-CA", zoneGb: "en-GB" };

/**
 * Constructing an `Intl.DateTimeFormat` costs orders of magnitude more than
 * calling one, and the match list renders hundreds of rows through a handful of
 * (style, zone) pairs. The instances are immutable, so one cache serves every
 * request on the server and the whole session in the browser.
 */
const cache = new Map<string, Intl.DateTimeFormat>();

function fmt(style: Style, tz: string): Intl.DateTimeFormat {
  const key = `${style}|${tz}`;
  const hit = cache.get(key);
  if (hit) return hit;

  // Bounded in practice: a few styles across the reader's zone, the fallback
  // and the venue zones on the page. The guard only matters in dev, where a
  // ?tz= override can be cycled.
  if (cache.size > 64) cache.clear();

  const zone = isValidTimeZone(tz) ? tz : FALLBACK_TZ;
  const format = new Intl.DateTimeFormat(LOCALE[style] ?? "en-US", { timeZone: zone, ...OPTIONS[style] });
  cache.set(key, format);
  return format;
}

/* -------------------------------------------------------------------------- */
/* Day keys                                                                    */
/* -------------------------------------------------------------------------- */

/** Calendar day key (YYYY-MM-DD) for an instant, read in `tz`. */
export function dayKeyIn(iso: string | Date, tz: string): string {
  return fmt("dayKey", tz).format(typeof iso === "string" ? new Date(iso) : iso);
}

/** Day key for today in `tz`, or `offset` days from it. */
export function todayKeyIn(tz: string, offset = 0, now = new Date()): string {
  return dayKeyIn(new Date(now.getTime() + offset * 86_400_000), tz);
}

/**
 * The day a match is listed under: the reader's, except when no kickoff has
 * been published. Then `date` is only an anchor and the honest answer is the
 * venue's own day, which every reader should see the same way.
 */
export function matchDayKey(
  match: Pick<Match, "date" | "timeTbd" | "timezone">,
  tz: string,
): string {
  return dayKeyIn(match.date, match.timeTbd ? match.timezone : tz);
}

/** A day key is already a calendar date, so it renders as UTC noon in UTC. */
function instantForDayKey(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}

/** "Today", "Yesterday" or "Tomorrow" when the key is one of those. */
function relativeDay(key: string, today: string): string | null {
  const shift = (days: number) =>
    new Date(instantForDayKey(today).getTime() + days * 86_400_000).toISOString().slice(0, 10);
  if (key === today) return "Today";
  if (key === shift(-1)) return "Yesterday";
  if (key === shift(1)) return "Tomorrow";
  return null;
}

/** Heading above a day's fixtures: "Today" reads better than the date. */
export function formatDayLabel(key: string, today: string): string {
  return relativeDay(key, today) ?? fmt("heading", "UTC").format(instantForDayKey(key));
}

/** "Saturday, October 31" for a day key. */
export function formatDayKeyLong(key: string): string {
  return fmt("heading", "UTC").format(instantForDayKey(key));
}

/** Two-line label for the date strip chips. */
export function formatChipLabel(key: string, today: string): { top: string; bottom: string } {
  const instant = instantForDayKey(key);
  const relative = relativeDay(key, today);
  const short = fmt("short", "UTC").format(instant);
  if (relative) return { top: relative, bottom: short };
  return {
    top: fmt("weekday", "UTC").format(instant),
    bottom: `${short.split(" ")[0]} ${fmt("dayNumber", "UTC").format(instant)}`,
  };
}

/* -------------------------------------------------------------------------- */
/* Instants                                                                    */
/* -------------------------------------------------------------------------- */

export function formatKickoff(iso: string, tz: string, tbd: boolean): string {
  return tbd ? "TBA" : fmt("time", tz).format(new Date(iso));
}

export function formatShortDate(iso: string, tz: string): string {
  return fmt("short", tz).format(new Date(iso));
}

export function formatFullDate(iso: string, tz: string, tbd: boolean): string {
  const date = new Date(iso);
  return tbd
    ? `${fmt("heading", tz).format(date)} · time TBA`
    : fmt("full", tz).format(date);
}

/**
 * "CDT", "CEST", or "GMT+5:30" where a zone has no common abbreviation. Read at
 * the match's own instant, so a September game says CDT and a December one CST.
 *
 * Neither English locale knows every abbreviation: en-US calls Amsterdam
 * "GMT+2" and en-GB calls Chicago "GMT-5". Asking both and keeping whichever
 * answers with a name covers both sides of the Atlantic, and a zone neither
 * has a name for keeps its offset, which at least says exactly what it means.
 */
export function formatZoneAbbr(iso: string, tz: string): string {
  const at = new Date(iso);
  const read = (style: Style) =>
    fmt(style, tz).formatToParts(at).find((entry) => entry.type === "timeZoneName")?.value ?? "";

  const us = read("zone");
  if (!us.startsWith("GMT")) return us;
  const gb = read("zoneGb");
  return gb.startsWith("GMT") ? us : gb;
}
