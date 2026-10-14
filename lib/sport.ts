/**
 * Men's and women's soccer. Every page lives under `/men` or `/women`; the
 * schools are shared, everything played or listed is per sport. Women's match,
 * player and bracket ids start with "w-" so a doubleheader cannot collide with
 * the men's game, and men's ids stay as they always were.
 */

export type Sport = "men" | "women";

export const SPORTS: Sport[] = ["men", "women"];
export const DEFAULT_SPORT: Sport = "men";

/** Remembers the side a visitor used last, for `/`. Read by proxy.ts. */
export const SPORT_COOKIE = "cciw-sport";

export const SPORT_LABEL: Record<Sport, string> = {
  men: "Men's Soccer",
  women: "Women's Soccer",
};

export const SPORT_SHORT: Record<Sport, string> = {
  men: "Men",
  women: "Women",
};

export function isSport(value: unknown): value is Sport {
  return value === "men" || value === "women";
}

export function parseSport(value: unknown): Sport {
  return isSport(value) ? value : DEFAULT_SPORT;
}

/** Prefix of every match, player and bracket id of the sport. */
export function idPrefix(sport: Sport): string {
  return sport === "women" ? "w-" : "";
}

/** The sport a match, player or bracket id belongs to, read from its prefix. */
export function sportOfId(id: string): Sport {
  return id.startsWith("w-") ? "women" : "men";
}

/** `/matches/x` → `/women/matches/x`. */
export function sportHref(sport: Sport, path: string): string {
  return path === "/" ? `/${sport}` : `/${sport}${path}`;
}

/** A match page; the id says which sport. `query` is appended as is ("?tab=lineups"). */
export function matchHref(id: string, query = ""): string {
  return sportHref(sportOfId(id), `/matches/${id}${query}`);
}

export function teamHref(sport: Sport, slug: string, query = ""): string {
  return sportHref(sport, `/teams/${slug}${query}`);
}

/**
 * The same section on the other side. A match or player does not exist there,
 * so those go to the list; a school does, so its page stays.
 */
export function switchSportHref(pathname: string, to: Sport): string {
  const [, , section, slug] = pathname.split("/");
  if (section === "teams" && slug) return sportHref(to, `/teams/${slug}`);
  if (section === "players") return sportHref(to, "/standings#scoring-leaders");
  if (section === "matches" || section === "standings" || section === "teams") return sportHref(to, `/${section}`);
  return sportHref(to, "/");
}

const WOMENS = /\bwomen'?s?\b|\bwomens\b/i;
const MENS = /\bmen'?s?\b|\bmens\b/i;

/**
 * Does a title or link say it is the other sport's game? Schools file both on
 * one channel, and a title that leaves the sport out says nothing either way.
 */
export function saysOtherSport(text: string, sport: Sport): boolean {
  const clean = text.replace(/&#0?39;|&apos;/g, "'").replace(/’/g, "'");
  return sport === "men" ? WOMENS.test(clean) : MENS.test(clean) && !WOMENS.test(clean);
}
