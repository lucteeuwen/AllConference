/** Scraper settings. The school list itself lives in the `teams` table. */

export const SEASON = Number(process.env.SCRAPE_SEASON ?? new Date().getUTCFullYear());

/** Anything on a school's schedule before this is from another season. */
export const SEASON_START = `${SEASON}-07-01`;

export const CONFERENCE_TZ = "America/Chicago";

export const USER_AGENT =
  "AllConferenceBot/1.0 (CCIW men's soccer scores; +https://github.com/lucteeuwen/AllConference)";

/** Minimum gap between two requests to the same host. */
export const HOST_INTERVAL_MS = 1000;

export const LIVE = {
  /** A match is "active" from this long before kickoff… */
  leadMs: 15 * 60_000,
  /** …until this long after kickoff, unless it goes final first. */
  tailMs: 150 * 60_000,
  pollMs: 2 * 60_000,
  /** Leaves headroom under the workflow's 15 minute timeout. */
  budgetMs: 13 * 60_000,
};
