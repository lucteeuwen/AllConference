import { CONFERENCE_TZ } from "./config";

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/** "Valdes, Sebastian" → "Sebastian Valdes". Leaves "First Last" alone. */
export function firstLast(name: string): string {
  const clean = cleanText(name);
  const comma = clean.indexOf(",");
  if (comma === -1) return clean;
  return cleanText(`${clean.slice(comma + 1)} ${clean.slice(0, comma)}`);
}

export function toInt(value: string | null | undefined): number | null {
  const match = cleanText(value).match(/^-?\d+/);
  return match ? Number(match[0]) : null;
}

/** "08:26" on the match clock is the 9th minute. */
export function clockToMinute(clock: string): number {
  const [minutes, seconds] = cleanText(clock).split(":").map(Number);
  if (!Number.isFinite(minutes)) return 0;
  return seconds === 0 && minutes > 0 ? minutes : minutes + 1;
}

/** Calendar day for an instant in `tz`. */
export function dayIn(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/**
 * Central-time calendar day. This is the conference's own day, and it is what
 * the match id and the merge key are built from: it must never follow a
 * reader's zone, or every /matches/<id> URL would move.
 */
export function centralDay(iso: string): string {
  return dayIn(iso, CONFERENCE_TZ);
}

/**
 * The UTC instant at which `tz`'s wall clock reads `local`
 * ("2026-10-31T12:00:00"). Used when a feed has no UTC date (TBA games).
 */
export function wallClockToUtc(local: string, tz: string): string {
  const naive = new Date(`${local.slice(0, 19)}Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(naive);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asLocal = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offset = asLocal - naive.getTime();
  return new Date(naive.getTime() - offset).toISOString();
}

export function centralToUtc(local: string): string {
  return wallClockToUtc(local, CONFERENCE_TZ);
}

/** Two or three letters for a fallback badge: "Loras College" → "LC". */
export function abbreviate(name: string): string {
  const skip = new Set(["of", "the", "at", "and", "college", "university"]);
  const words = cleanText(name.replace(/\(.*?\)/g, ""))
    .split(/[\s-]+/)
    .filter((word) => word && !skip.has(word.toLowerCase()));
  if (words.length === 0) return name.slice(0, 3).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/**
 * Display name for a non-conference opponent: drop the generic words so the
 * card reads "Loras" rather than "Loras College", but keep names like
 * "University of Chicago" readable.
 */
export function shortName(name: string): string {
  const clean = cleanText(name);
  const trimmed = cleanText(clean.replace(/\b(College|University)\b(?! of)/g, ""));
  return trimmed.length >= 3 ? trimmed : clean;
}
