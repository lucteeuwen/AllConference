import type { Sport } from "@/lib/sport";

/** Scraper settings. The school list itself lives in the `teams` table. */

export const SEASON = Number(process.env.SCRAPE_SEASON ?? new Date().getUTCFullYear());

/** Anything on a school's schedule before this is from another season. */
export const SEASON_START = `${SEASON}-07-01`;

export const CONFERENCE_TZ = "America/Chicago";

export const USER_AGENT =
  "AllConferenceBot/1.0 (CCIW soccer scores; +https://github.com/lucteeuwen/AllConference)";

/** Minimum gap between two requests to the same host. */
export const HOST_INTERVAL_MS = 1000;

/**
 * Minimum gap between any two requests, whatever the host. The nine schools'
 * sites are separate hosts but one SIDEARM platform (several share a server),
 * so the per-host gap alone let a run reach ~9 requests a second against it.
 */
export const GLOBAL_INTERVAL_MS = 500;

/**
 * `--auto` does a full pass when the last one is older than this. The cron
 * fires every 30 minutes, but GitHub starts runs late by varying amounts (a
 * 24-minute gap has been seen), so this sits well under 30.
 */
export const FULL_EVERY_MS = 20 * 60_000;

/**
 * Live polling, only with `--live`. Off by default: SIDEARM does not update a
 * game while it is being played (a week of polls in October 2026 caught 2
 * changes, both the final whistle), so it was load on the schools for nothing.
 */
export const LIVE = {
  /** A match is "active" from this long before kickoff… */
  leadMs: 15 * 60_000,
  /** …until this long after kickoff, unless it goes final first. */
  tailMs: 150 * 60_000,
  pollMs: 60_000,
  /** How long one run keeps polling. */
  budgetMs: 9 * 60_000,
};

/** What differs between the two sports on the sites the scraper reads. */
export const SPORT_SOURCES: Record<
  Sport,
  {
    /** SIDEARM's path segment: `/sports/<path>/schedule`. */
    path: string;
    /** Hudl vCloud section, the same number on every vCloud site. */
    hudlSection: number;
    /** The United Soccer Coaches NCAA DIII poll. */
    pollUrl: string;
    /** SIDEARM Stats' sport folder: `sidearmstats.com/<school>/<statsSport>/`. */
    statsSport: string;
  }
> = {
  men: {
    path: "mens-soccer",
    hudlSection: 103,
    pollUrl: "https://unitedsoccercoaches.org/rankings/college-rankings/ncaa-diii-men/",
    statsSport: "msoc",
  },
  women: {
    path: "womens-soccer",
    hudlSection: 3772,
    pollUrl: "https://unitedsoccercoaches.org/rankings/college-rankings/ncaa-diii-women/",
    statsSport: "wsoc",
  },
};

/**
 * SIDEARM Stats live feeds (see ./sidearm/livestats). Each member's folder, the
 * same for both sports, so its home games are read without first finding the
 * folder on its stats page.
 */
export const LIVESTATS = {
  base: "https://sidearmstats.com",
  folders: {
    augustana: "augustana",
    carroll: "carrollu",
    carthage: "carthage",
    elmhurst: "elmhurst",
    "illinois-wesleyan": "iwu",
    millikin: "millikin",
    "north-central": "ncc",
    "north-park": "nparku",
    wheaton: "wheaton",
  } as Record<string, string>,
};

/**
 * The CCIW Network (cciwnetwork.com) is a portal over Hudl vCloud. Its config
 * lists these nine school sites; each sport is one section on every vCloud site
 * (see SPORT_SOURCES), so the other conferences' networks are read the same way.
 */
export const BROADCASTS = {
  api: "https://vcloud.hudl.com/api/viewer/broadcast",
  portal: "https://cciwnetwork.com",
  /** Hudl vCloud portals, where `<portal>/<site>/` is one school's channel. */
  portals: [
    "cciwnetwork.com",
    "wiacnetwork.com",
    "miaasportsnetwork.com",
    "miacsportsnetwork.com",
    "rollriversnetwork.com",
    "centraldutchnetwork.com",
    "watchmidwestsports.com",
  ],
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

/**
 * YouTube Data API, for schools that link only their channel. Optional: without
 * a key those games keep whatever link they had.
 */
export const YOUTUBE = {
  api: "https://www.googleapis.com/youtube/v3",
  key: process.env.YOUTUBE_API_KEY || null,
};
