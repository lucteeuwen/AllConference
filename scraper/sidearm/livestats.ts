import type { Sport } from "@/lib/sport";
import type { MatchStatus } from "@/lib/types";
import { LIVESTATS, SPORT_SOURCES } from "../config";
import { fetchJson, fetchText } from "../http";
import type { MatchRecord, TeamResolver } from "../merge";
import { centralDay, cleanText } from "../normalize";

/**
 * SIDEARM Stats, the live stats a host school's stat crew keeps during the
 * game: `https://sidearmstats.com/<folder>/<msoc|wsoc>/game.json`. Unlike the
 * scoreboard feed, which schools update after the game, this one carries the
 * score as it happens. It holds one game per school, the latest one the host
 * opened, so it says nothing about a match until its date and teams agree.
 */

export type LiveStatsTeam = { Name: string; Score: number | null };

export type LiveStatsFeed = {
  Game: {
    HasStarted: boolean;
    IsComplete: boolean;
    /** "10/10/2026", the host's own day. */
    Date: string;
    HomeTeam: LiveStatsTeam;
    VisitingTeam: LiveStatsTeam;
  } | null;
};

export type LiveStats = {
  /** "2026-10-10". */
  day: string;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  started: boolean;
  complete: boolean;
};

export function liveStatsUrl(folder: string, sport: Sport): string {
  return `${LIVESTATS.base}/${folder}/${SPORT_SOURCES[sport].statsSport}/game.json?detail=game`;
}

function isoDay(us: string): string | null {
  const match = cleanText(us).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function score(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

export function parseLiveStats(feed: LiveStatsFeed): LiveStats | null {
  const game = feed?.Game;
  if (!game) return null;
  const day = isoDay(game.Date);
  const homeName = cleanText(game.HomeTeam?.Name);
  const awayName = cleanText(game.VisitingTeam?.Name);
  if (!day || !homeName || !awayName) return null;
  return {
    day,
    homeName,
    awayName,
    homeScore: score(game.HomeTeam.Score),
    awayScore: score(game.VisitingTeam.Score),
    started: game.HasStarted === true,
    complete: game.IsComplete === true,
  };
}

/**
 * The feed's folder from a game's stats link, when the link names it:
 * `sidearmstats.com/<folder>/msoc/`. The other form, a school's own
 * `/sidearmstats/<sport>/summary`, only names it inside the page.
 */
export function folderFromStatsUrl(url: string | null | undefined): string | null {
  try {
    const parsed = new URL(cleanText(url));
    if (!/(^|\.)sidearmstats\.com$/i.test(parsed.hostname)) return null;
    const folder = parsed.pathname.split("/").filter(Boolean)[0];
    return folder ? folder.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** `window.livestats_foldername = "wheaton"` on a school's summary page. */
export function folderFromSummaryPage(html: string): string | null {
  return html.match(/livestats_foldername\s*=\s*["']([^"']+)["']/)?.[1].toLowerCase() ?? null;
}

function dayDiff(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

/**
 * The record with the feed's score and status laid over it, or null when the
 * feed is about another game. The feed's day is the host's, which can be a day
 * off the conference's for a late kickoff out west, so one day either way is
 * allowed; the two teams must be the match's two teams.
 */
export function applyLiveStats<
  T extends Pick<MatchRecord, "date" | "status" | "home_slug" | "away_slug" | "home_score" | "away_score">,
>(record: T, stats: LiveStats, resolver: TeamResolver): T | null {
  if (dayDiff(stats.day, centralDay(record.date)) > 1) return null;

  const feedHome = resolver.resolve(stats.homeName, null);
  const feedAway = resolver.resolve(stats.awayName, null);
  const same = feedHome === record.home_slug && feedAway === record.away_slug;
  const swapped = feedHome === record.away_slug && feedAway === record.home_slug;
  if (!same && !swapped) return null;

  // Not under way yet, or the school already posted a result the stat crew
  // never closed out: the scoreboard feed knows as much.
  if (!stats.started || (record.status === "final" && !stats.complete)) return record;
  const status: MatchStatus = stats.complete ? "final" : "live";
  if (stats.homeScore === null || stats.awayScore === null) return { ...record, status };
  return {
    ...record,
    status,
    home_score: same ? stats.homeScore : stats.awayScore,
    away_score: same ? stats.awayScore : stats.homeScore,
  };
}

/**
 * Finds and reads the live stats for one poll's matches. Folders found on a
 * summary page are remembered for the rest of the run; each feed is read at
 * most once per poll.
 */
export class LiveStatsReader {
  private folders = new Map<string, string | null>();

  constructor(
    private sport: Sport,
    private log: (message: string) => void,
  ) {}

  /** Folders worth trying for a match: a member host's own, else the game's stats link. */
  async foldersFor(record: Pick<MatchRecord, "home_slug" | "stats_url">): Promise<string[]> {
    const known = record.home_slug ? LIVESTATS.folders[record.home_slug] : undefined;
    if (known) return [known];
    const linked = await this.folderOf(record.stats_url);
    return linked ? [linked] : [];
  }

  private async folderOf(url: string | null | undefined): Promise<string | null> {
    if (!url) return null;
    const direct = folderFromStatsUrl(url);
    if (direct) return direct;
    if (!/\/sidearmstats\//i.test(url)) return null;
    if (this.folders.has(url)) return this.folders.get(url) ?? null;
    let folder: string | null = null;
    try {
      folder = folderFromSummaryPage(await fetchText(url));
    } catch (error) {
      this.log(`WARN live stats page ${url}: ${(error as Error).message}`);
    }
    this.folders.set(url, folder);
    return folder;
  }

  /** One poll's reads, keyed by folder. A failed read is null. */
  async read(folders: string[]): Promise<Map<string, LiveStats | null>> {
    const unique = [...new Set(folders)];
    const results = await Promise.all(
      unique.map(async (folder) => {
        try {
          return parseLiveStats(await fetchJson<LiveStatsFeed>(liveStatsUrl(folder, this.sport)));
        } catch (error) {
          this.log(`WARN live stats ${folder}: ${(error as Error).message}`);
          return null;
        }
      }),
    );
    return new Map(unique.map((folder, index) => [folder, results[index]]));
  }
}
