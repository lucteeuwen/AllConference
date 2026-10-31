import type { Sport } from "@/lib/sport";
import type { MatchEventType, MatchStatus } from "@/lib/types";
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

type FeedPlayer = {
  Team?: string | null;
  FirstName?: string | null;
  LastName?: string | null;
  UniformNumber?: string | null;
};

export type FeedPlay = {
  Id?: string | null;
  Type?: string | null;
  /** "HomeTeam" or "VisitingTeam". */
  Team?: string | null;
  Player?: FeedPlayer | null;
  InvolvedPlayers?: FeedPlayer[] | null;
  Narrative?: string | null;
  Period?: number | null;
  ClockSeconds?: number | null;
  Qualifiers?: string[] | null;
};

export type LiveStatsFeed = {
  Game: {
    HasStarted: boolean;
    IsComplete: boolean;
    /** "10/10/2026", the host's own day. */
    Date: string;
    HomeTeam: LiveStatsTeam;
    VisitingTeam: LiveStatsTeam;
    /** Minutes in a regulation half, 45 in soccer. */
    Rules?: { PeriodMinutes?: number | null } | null;
    /** Only the last handful of plays: a busy minute can scroll past between two polls. */
    LastPlays?: FeedPlay[] | null;
  } | null;
};

export type LivePlayer = { name: string; number: number | null };

export type LivePlay = {
  id: string;
  /** The running number in front of the id, which only grows during a game. */
  sequence: number;
  type: string;
  /** Which side of the feed's own home/visitor split the play is for. */
  side: "home" | "away" | null;
  player: LivePlayer | null;
  involved: LivePlayer[];
  narrative: string;
  period: number | null;
  clockSeconds: number;
  qualifiers: string[];
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
  /** Minutes in a regulation half. */
  periodMinutes: number;
  plays: LivePlay[];
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

function sideOf(team: string | null | undefined): "home" | "away" | null {
  return team === "HomeTeam" ? "home" : team === "VisitingTeam" ? "away" : null;
}

function playerOf(player: FeedPlayer | null | undefined): LivePlayer | null {
  const name = cleanText(`${player?.FirstName ?? ""} ${player?.LastName ?? ""}`);
  if (!name) return null;
  const number = Number.parseInt(cleanText(player?.UniformNumber), 10);
  return { name, number: Number.isFinite(number) ? number : null };
}

function playOf(play: FeedPlay): LivePlay | null {
  const id = cleanText(play.Id);
  const type = cleanText(play.Type).toUpperCase();
  if (!id || !type || typeof play.ClockSeconds !== "number") return null;
  return {
    id,
    sequence: Number.parseInt(id, 10) || 0,
    type,
    side: sideOf(play.Team),
    player: playerOf(play.Player),
    involved: (play.InvolvedPlayers ?? []).map(playerOf).filter((player) => player !== null),
    narrative: cleanText(play.Narrative),
    period: typeof play.Period === "number" ? play.Period : null,
    clockSeconds: play.ClockSeconds,
    qualifiers: (play.Qualifiers ?? []).map((qualifier) => cleanText(qualifier).toLowerCase()),
  };
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
    periodMinutes: game.Rules?.PeriodMinutes && game.Rules.PeriodMinutes > 0 ? game.Rules.PeriodMinutes : 45,
    plays: (game.LastPlays ?? []).map(playOf).filter((play) => play !== null),
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
 * Whether the feed lists the match's two teams the other way round (its home
 * is the match's away side), or null when it is about another game. The feed's
 * day is the host's, which can be a day off the conference's for a late
 * kickoff out west, so one day either way is allowed; the two teams must be
 * the match's two teams.
 */
export function feedSwapped(
  record: Pick<MatchRecord, "date" | "home_slug" | "away_slug">,
  stats: LiveStats,
  resolver: TeamResolver,
): boolean | null {
  if (dayDiff(stats.day, centralDay(record.date)) > 1) return null;

  const feedHome = resolver.resolve(stats.homeName, null);
  const feedAway = resolver.resolve(stats.awayName, null);
  if (feedHome === record.home_slug && feedAway === record.away_slug) return false;
  if (feedHome === record.away_slug && feedAway === record.home_slug) return true;
  return null;
}

/** The record with the feed's score and status laid over it, or null when the feed is about another game. */
export function applyLiveStats<
  T extends Pick<MatchRecord, "date" | "status" | "home_slug" | "away_slug" | "home_score" | "away_score">,
>(record: T, stats: LiveStats, resolver: TeamResolver): T | null {
  const swapped = feedSwapped(record, stats, resolver);
  if (swapped === null) return null;

  // Not under way yet, or the school already posted a result the stat crew
  // never closed out: the scoreboard feed knows as much.
  if (!stats.started || (record.status === "final" && !stats.complete)) return record;
  const status: MatchStatus = stats.complete ? "final" : "live";
  if (stats.homeScore === null || stats.awayScore === null) return { ...record, status };
  return {
    ...record,
    status,
    home_score: swapped ? stats.awayScore : stats.homeScore,
    away_score: swapped ? stats.homeScore : stats.awayScore,
  };
}

/** A play worth a line on the match page's timeline, in the match's own terms. */
export type LiveEvent = {
  /** The feed's id for the play; keeps a re-read from adding it twice. */
  sourceId: string;
  sort: number;
  minute: number;
  type: MatchEventType;
  /** The match's home or away side; null for a marker like half time. */
  side: "home" | "away" | null;
  player: LivePlayer | null;
  assists: LivePlayer[];
  detail: string | null;
};

/** The same count-up convention as a box score's clock: 08:26 is the 9th minute, 45:00 the 45th. */
export function minuteOfClock(seconds: number): number {
  const minutes = Math.floor(seconds / 60);
  return seconds % 60 === 0 && minutes > 0 ? minutes : minutes + 1;
}

/** "MISSED high", "BLOCKED" or "SAVED" from "Shot by AUG Wise,Silas, MISSED high". */
function shotDetail(narrative: string): string | null {
  const rest = narrative.match(/^Shot by [^,]+,[^,]+,\s*(.+)$/i)?.[1];
  return rest ? rest.toLowerCase() : null;
}

/** "for Neumann,Matthew" from the player coming off. */
function forPlayer(off: LivePlayer | null): string | null {
  return off ? `for ${off.name}` : null;
}

/**
 * The plays a timeline shows. Goals, cards, substitutions, shots, fouls,
 * corners and free kicks, plus the start of each half, half time and full
 * time. Throw-ins, goal kicks and the kickoff after a goal are noise.
 * `swapped` is `feedSwapped`: whether the feed's home is the match's away side.
 */
export function liveEvents(stats: LiveStats, swapped: boolean): LiveEvent[] {
  const side = (play: LivePlay): "home" | "away" | null =>
    play.side === null ? null : (play.side === "home") !== swapped ? "home" : "away";

  const events: LiveEvent[] = [];
  for (const play of stats.plays) {
    const base = { sourceId: play.id, sort: play.sequence, minute: minuteOfClock(play.clockSeconds), side: side(play) };
    const named = { player: play.player, assists: [] as LivePlayer[], detail: null as string | null };

    switch (play.type) {
      case "GOAL": {
        const penalty = play.qualifiers.some((q) => q.includes("penalty")) || /penalty/i.test(play.narrative);
        const own = play.qualifiers.some((q) => q.includes("own")) || /own[- ]?goal/i.test(play.narrative);
        events.push({
          ...base,
          ...named,
          type: own ? "own-goal" : penalty ? "penalty" : "goal",
          assists: own ? [] : play.involved,
        });
        break;
      }
      case "YC":
      case "RC":
        events.push({ ...base, ...named, type: play.type === "YC" ? "yellow" : "red" });
        break;
      case "SUB":
        // The feed names the player coming off, then the one coming on.
        events.push({
          ...base,
          ...named,
          type: "sub",
          player: play.involved[0] ?? play.player,
          detail: play.involved[0] ? forPlayer(play.player) : "off",
        });
        break;
      case "SHOT":
        events.push({ ...base, ...named, type: "shot", detail: shotDetail(play.narrative) });
        break;
      case "FOUL":
        events.push({ ...base, ...named, type: "foul" });
        break;
      case "CORNER":
        events.push({ ...base, ...named, type: "corner" });
        break;
      case "FREEKICK":
        events.push({ ...base, ...named, type: "freekick" });
        break;
      case "KICKOFF": {
        // Every goal is followed by a kickoff; only a half's first one counts.
        const half = stats.periodMinutes * 60;
        const into = play.clockSeconds - Math.max(0, ((play.period ?? 1) - 1)) * half;
        if (play.period === null || play.period > 2 || into > 10) break;
        events.push({ ...base, ...named, type: "period", detail: play.period === 1 ? "Kickoff" : "Second half" });
        break;
      }
      case "PRD":
        // The end of the first period is half time; the last one is also "game end".
        if (play.period === 1) events.push({ ...base, ...named, type: "period", detail: "Half time" });
        break;
      case "GAME":
        events.push({ ...base, ...named, type: "period", detail: "Full time" });
        break;
    }
  }
  return events;
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
