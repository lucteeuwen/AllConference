import type { MatchStatus } from "@/lib/types";
import { LIVE } from "./config";
import type { MatchRecord } from "./merge";

/**
 * The narrow half of the scraper. While a match is on we only re-read the
 * schools playing in it and only write the columns a game changes: never the
 * whole season, the bracket, logos or rosters.
 */

export type LiveRow = {
  id: string;
  date: string;
  status: MatchStatus;
  time_tbd: boolean;
  started_at: string | null;
  finished_at: string | null;
  home_slug: string | null;
  away_slug: string | null;
  home_score: number | null;
  away_score: number | null;
  home_pens: number | null;
  away_pens: number | null;
  boxscore_url: string | null;
  video_url: string | null;
  events_scraped: boolean;
};

export const LIVE_COLUMNS =
  "id, date, status, time_tbd, started_at, finished_at, home_slug, away_slug, home_score, away_score, home_pens, away_pens, boxscore_url, video_url, events_scraped";

/** Estimated full-time for matches we never saw finish. */
export function estimatedFinish(date: string): string {
  return new Date(new Date(date).getTime() + 115 * 60_000).toISOString();
}

/**
 * A match is worth polling from shortly before kickoff until it has had time to
 * finish, and a finished one until its box score has been read (if it has one).
 */
export function isActive(row: LiveRow, now = Date.now()): boolean {
  if (row.time_tbd || row.status === "postponed" || row.status === "canceled") return false;
  const kickoff = Date.parse(row.date);
  if (now < kickoff - LIVE.leadMs || now > kickoff + LIVE.tailMs) return false;
  if (row.status === "final") return Boolean(row.boxscore_url) && !row.events_scraped;
  return true;
}

const RANK: Partial<Record<MatchStatus, number>> = { scheduled: 0, live: 1, final: 2 };

/**
 * What to write for `row` given a fresh read of its feed, or null when nothing
 * changed. A feed that briefly looks behind what we stored (a school's page
 * reverting, a score field going blank) never rolls the match back.
 */
export function livePatch(row: LiveRow, record: MatchRecord, now = Date.now()): Partial<LiveRow> | null {
  const patch: Partial<LiveRow> = {};

  const from = RANK[row.status];
  const to = RANK[record.status];
  const advancing = to === undefined || from === undefined || to >= from;

  if (advancing) {
    if (record.status !== row.status) patch.status = record.status;
    for (const key of ["home_score", "away_score", "home_pens", "away_pens"] as const) {
      if (record[key] !== null && record[key] !== row[key]) patch[key] = record[key];
    }

    if (record.status === "final" && !row.finished_at) {
      // Seen going final just now, unless the result was posted long after the
      // game: then estimate full time.
      const estimate = estimatedFinish(row.date);
      patch.finished_at = now < Date.parse(estimate) + 60 * 60_000 ? new Date(now).toISOString() : estimate;
    }

    // First seen in play right around kickoff: that is when it started. Seen
    // any later and it says nothing about the start, so leave the estimate be.
    const late = now - Date.parse(row.date);
    if (row.status === "scheduled" && record.status === "live" && !row.started_at && late >= -5 * 60_000 && late <= 10 * 60_000) {
      patch.started_at = new Date(Math.max(now, Date.parse(row.date))).toISOString();
    }
  }

  if (record.boxscore_url && record.boxscore_url !== row.boxscore_url) patch.boxscore_url = record.boxscore_url;
  if (record.video_url && record.video_url !== row.video_url) patch.video_url = record.video_url;

  return Object.keys(patch).length ? patch : null;
}
