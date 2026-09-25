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
  pollMs: 60_000,
  /**
   * How long one run keeps polling. The workflow starts a run every five
   * minutes, so the next one is already queued when this ends.
   */
  budgetMs: 9 * 60_000,
  /** A full pass (every feed, the bracket, logos) is at most this stale. */
  fullEveryMs: 14 * 60_000,
};

/**
 * The CCIW Network (cciwnetwork.com) is a portal over Hudl vCloud. Its config
 * lists these nine school sites; section 103 is men's soccer.
 */
export const BROADCASTS = {
  api: "https://vcloud.hudl.com/api/viewer/broadcast",
  portal: "https://cciwnetwork.com",
  section: 103,
  /** Each school's site on the network, and the team it is. */
  sites: {
    ACVikings: "augustana",
    carrollpioneers: "carroll",
    carthage: "carthage",
    elmhurst: "elmhurst",
    IWUTitans: "illinois-wesleyan",
    millikinathletics: "millikin",
    northcentralcardinals: "north-central",
    northpark: "north-park",
    wheatoncollege: "wheaton",
  } as Record<string, string>,
};
