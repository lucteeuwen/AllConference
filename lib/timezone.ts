/**
 * Time zones, kept free of React so both the server and the browser can use
 * them. Kickoffs are stored as UTC instants; which zone they are *rendered* in
 * is a display choice, and this module holds the two zones that choice needs:
 * the reader's own, and the one the server falls back to before it knows.
 */

/**
 * What the server renders and what the browser hydrates with. The server
 * cannot know the reader's zone, so it renders the conference's and the
 * browser corrects it after mount; picking Central means the overwhelming
 * majority of readers never see a correction at all.
 */
export const FALLBACK_TZ = "America/Chicago";

/** The reader's own zone, or the fallback when the browser will not say. */
export function resolveViewerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TZ;
  } catch {
    return FALLBACK_TZ;
  }
}

/** Cheap guard: a browser can report a zone this runtime has never heard of. */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const wallClockFormat = new Map<string, Intl.DateTimeFormat>();

function wallClock(tz: string, at: number): string {
  let format = wallClockFormat.get(tz);
  if (!format) {
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    wallClockFormat.set(tz, format);
  }
  return format.format(at);
}

/**
 * Do two zones read the same clock at this instant? Compared at the match's own
 * time, not at now, because the answer moves: Phoenix and Los Angeles agree in
 * July and not in January. Detroit and New York always agree, so a match page
 * never offers a reader in one a "local at venue" row for the other.
 */
export function sameWallClock(a: string, b: string, at: number): boolean {
  if (a === b) return true;
  try {
    return wallClock(a, at) === wallClock(b, at);
  } catch {
    return true;
  }
}
