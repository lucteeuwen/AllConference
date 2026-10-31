import type { MatchEventType, MatchStatus } from "@/lib/types";
import { LIVE } from "./config";
import type { MatchRecord } from "./merge";
import type { LiveEvent, LivePlayer } from "./sidearm/livestats";

/**
 * The narrow half of the scraper. While a match is on we only read the host's
 * SIDEARM Stats feed (see ./sidearm/livestats) and only write what a game
 * changes: its status and score, its timeline of plays and the season totals of
 * the players in them. Never the schools' own sites, the bracket, logos or
 * rosters. The official box score replaces the goals and cards at full time.
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
 * A match is worth polling from shortly before kickoff until it goes final or
 * has had time to finish.
 */
export function isActive(row: LiveRow, now = Date.now()): boolean {
  if (row.time_tbd || (row.status !== "scheduled" && row.status !== "live")) return false;
  const kickoff = Date.parse(row.date);
  return now >= kickoff - LIVE.leadMs && now <= kickoff + LIVE.tailMs;
}

/** True when a match not yet active will be by `until`, so a run should wait for it. */
export function becomesActive(row: LiveRow, now: number, until: number): boolean {
  const from = Date.parse(row.date) - LIVE.leadMs;
  return from > now && from <= until && isActive(row, from);
}

const RANK: Partial<Record<MatchStatus, number>> = { scheduled: 0, live: 1, final: 2 };

export type StoredResult = {
  status: string;
  home_score?: number | null;
  away_score?: number | null;
};

/**
 * The full pass reads only the scoreboard feeds, which lag the live stats live
 * mode reads. Where the stored match is further on than the feed (live while
 * the feed still says scheduled, final while it says live), keep the stored
 * status and score so a full pass never rolls a game back.
 */
export function keepAhead<T extends Pick<MatchRecord, "status" | "home_score" | "away_score">>(
  match: T,
  stored: StoredResult | undefined,
): T {
  if (!stored) return match;
  const from = RANK[stored.status as MatchStatus];
  const to = RANK[match.status];
  if (from === undefined || to === undefined || from <= to) return match;
  return {
    ...match,
    status: stored.status as MatchStatus,
    home_score: stored.home_score ?? match.home_score,
    away_score: stored.away_score ?? match.away_score,
  };
}

/**
 * What to write for `row` given a fresh read of its feed, or null when nothing
 * changed. A feed that briefly looks behind what we stored (a school's page
 * reverting, a score field going blank) never rolls the match back.
 */
export function livePatch(
  row: LiveRow,
  record: Pick<MatchRecord, "status" | "home_score" | "away_score" | "home_pens" | "away_pens" | "boxscore_url" | "video_url">,
  now = Date.now(),
): Partial<LiveRow> | null {
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

/*
 * Live plays. The stats feed only lists the last few plays, so each poll is
 * reconciled with what is already stored: new plays are added once, a goal the
 * feed's score shows but no play named gets a placeholder, and player totals
 * move by exactly the plays that are new.
 */

/** A `match_events` row as live mode writes it. */
export type EventRow = {
  match_id: string;
  sort: number;
  minute: number;
  type: MatchEventType;
  team_slug: string | null;
  player_name: string;
  player_id: string | null;
  assist_name: string | null;
  assist_player_id: string | null;
  source_id: string | null;
  detail: string | null;
  counted: boolean;
};

/** The columns of a stored row that deciding what is new needs. */
export type StoredEvent = Pick<
  EventRow,
  "type" | "team_slug" | "minute" | "player_name" | "player_id" | "assist_player_id" | "source_id" | "counted"
>;

/** What the player's season totals change by. */
export type StatDelta = { goals: number; assists: number; yellow: number; red: number; pk: number };

const GOAL_ROWS = new Set<MatchEventType>(["goal", "penalty", "own-goal"]);
const CARD_ROWS = new Set<MatchEventType>(["yellow", "red"]);

/** What a play with no named player is called; the match page prints it as plain "Goal". */
export const UNKNOWN_PLAYER = "Unknown";

const GAP_PREFIX = "gap-";

export type RosterEntry = { id: string; number: number | null; name: string };

/**
 * The roster player a play names: by the id their name makes, else by jersey
 * number when the surname agrees (a nickname or a middle name changes the id).
 */
export function resolvePlayerId(roster: RosterEntry[], idFromName: string, player: LivePlayer | null): string | null {
  if (!player) return null;
  if (roster.some((entry) => entry.id === idFromName)) return idFromName;
  if (player.number === null) return null;
  const surname = player.name.split(/\s+/).at(-1)?.toLowerCase();
  const byNumber = roster.filter(
    (entry) => entry.number === player.number && !!surname && entry.name.toLowerCase().includes(surname),
  );
  return byNumber.length === 1 ? byNumber[0].id : null;
}

/**
 * Timeline rows for a poll's plays. `resolve` finds a roster id for a player
 * of a team (null when unknown). An own goal is not credited to its scorer.
 */
export function eventRows(
  match: { id: string; home_slug: string | null; away_slug: string | null },
  events: LiveEvent[],
  resolve: (teamSlug: string, player: LivePlayer) => string | null,
): EventRow[] {
  return events.map((event) => {
    const team = event.side === "home" ? match.home_slug : event.side === "away" ? match.away_slug : null;
    const own = event.type === "own-goal";
    const scorer = event.player && team && !own ? resolve(team, event.player) : null;
    const assists = event.assists.filter((assist) => assist.name);
    return {
      match_id: match.id,
      sort: event.sort,
      minute: event.minute,
      type: event.type,
      team_slug: team,
      player_name: event.player?.name ?? UNKNOWN_PLAYER,
      player_id: scorer,
      // A shared assist is "A , B", as the box score prints it.
      assist_name: assists.length ? assists.map((assist) => assist.name).join(" , ") : null,
      assist_player_id: assists[0] && team ? resolve(team, assists[0]) : null,
      source_id: event.sourceId,
      detail: event.detail,
      counted: false,
    };
  });
}

const sameMoment = (a: StoredEvent, b: StoredEvent) =>
  a.type === b.type && a.team_slug === b.team_slug && a.minute === b.minute && a.player_name === b.player_name;

/**
 * The rows not stored yet. A play is known by its id; a goal or card is also
 * dropped when the same player already has that type in that minute, in case
 * the stat crew's edit gave a play a new id.
 */
export function freshEvents(stored: StoredEvent[], rows: EventRow[]): EventRow[] {
  const ids = new Set(stored.map((event) => event.source_id).filter((id) => id !== null));
  const seen = [...stored];
  const fresh: EventRow[] = [];
  for (const row of rows) {
    if (row.source_id && ids.has(row.source_id)) continue;
    const scoring = GOAL_ROWS.has(row.type) || CARD_ROWS.has(row.type);
    if (scoring && row.player_name !== UNKNOWN_PLAYER && seen.some((event) => sameMoment(event, row))) continue;
    fresh.push(row);
    seen.push(row);
  }
  return fresh;
}

/**
 * Which side a goal row counts for. An own goal is filed under the player's
 * own team, as every play in the feed is, so it counts for the other side.
 */
function goalFor(
  row: Pick<EventRow, "type" | "team_slug">,
  match: { home_slug: string | null; away_slug: string | null },
): "home" | "away" | null {
  if (!GOAL_ROWS.has(row.type)) return null;
  const side = row.team_slug === match.home_slug ? "home" : row.team_slug === match.away_slug ? "away" : null;
  if (!side || row.type !== "own-goal") return side;
  return side === "home" ? "away" : "home";
}

/**
 * Rows to remove and add so the timeline's goals add up to the feed's score.
 * A goal whose play scrolled out of the feed's window becomes a placeholder;
 * a placeholder goes again once the play that names the goal turns up.
 */
export function reconcileGoals(
  match: { id: string; home_slug: string | null; away_slug: string | null },
  stored: StoredEvent[],
  fresh: EventRow[],
  score: { home: number | null; away: number | null },
  minute: number,
): { drop: string[]; add: EventRow[] } {
  const named = fresh.filter((row) => goalFor(row, match));
  const placeholders = stored
    .filter((event) => event.source_id?.startsWith(GAP_PREFIX))
    .sort((a, b) => (a.source_id as string).localeCompare(b.source_id as string));

  const drop: string[] = [];
  for (const row of named) {
    const side = goalFor(row, match);
    const gap = placeholders.find(
      (event) => !drop.includes(event.source_id as string) && goalFor(event, match) === side,
    );
    if (gap) drop.push(gap.source_id as string);
  }

  const kept = [...stored.filter((event) => !drop.includes(event.source_id ?? "")), ...fresh];
  const add: EventRow[] = [];
  for (const side of ["home", "away"] as const) {
    const goals = score[side];
    const team = side === "home" ? match.home_slug : match.away_slug;
    if (goals === null || !team) continue;
    const have = kept.filter((row) => goalFor(row, match) === side).length;
    for (let n = have + 1; n <= goals; n++) {
      add.push({
        match_id: match.id,
        sort: 0,
        minute,
        type: "goal",
        team_slug: team,
        player_name: UNKNOWN_PLAYER,
        player_id: null,
        assist_name: null,
        assist_player_id: null,
        source_id: `${GAP_PREFIX}${side}-${n}`,
        detail: null,
        counted: false,
      });
    }
  }
  return { drop, add };
}

const none = (): StatDelta => ({ goals: 0, assists: 0, yellow: 0, red: 0, pk: 0 });

/**
 * What the plays in `rows` add to each player's totals. Only a known player is
 * credited; shots, fouls and the like count for nothing. `assists` is off when
 * comparing with a box score, which names a shared assist without ids.
 */
export function statDeltas(
  rows: Pick<EventRow, "type" | "player_id" | "assist_player_id">[],
  assists = true,
): Map<string, StatDelta> {
  const deltas = new Map<string, StatDelta>();
  const of = (id: string) => {
    let delta = deltas.get(id);
    if (!delta) deltas.set(id, (delta = none()));
    return delta;
  };
  for (const row of rows) {
    if (row.type === "goal" || row.type === "penalty") {
      if (row.player_id) {
        of(row.player_id).goals += 1;
        if (row.type === "penalty") of(row.player_id).pk += 1;
      }
      if (assists && row.assist_player_id) of(row.assist_player_id).assists += 1;
    } else if (row.type === "yellow" && row.player_id) of(row.player_id).yellow += 1;
    else if (row.type === "red" && row.player_id) of(row.player_id).red += 1;
  }
  return deltas;
}

/** Whether a row changes a player's totals at all, so it can be marked as counted. */
export function creditsStats(row: Pick<EventRow, "type" | "player_id" | "assist_player_id">): boolean {
  return statDeltas([row]).size > 0;
}

/**
 * What to change player totals by once the box score replaces a match's live
 * goals and cards: the box score's own count less what live mode already added.
 * Empty entries are left out.
 */
export function reconcileStats(
  counted: Pick<EventRow, "type" | "player_id" | "assist_player_id">[],
  box: Pick<EventRow, "type" | "player_id" | "assist_player_id">[],
): Map<string, StatDelta> {
  const live = statDeltas(counted, false);
  const official = statDeltas(box, false);
  const result = new Map<string, StatDelta>();
  for (const id of new Set([...live.keys(), ...official.keys()])) {
    const a = live.get(id) ?? none();
    const b = official.get(id) ?? none();
    const delta: StatDelta = {
      goals: b.goals - a.goals,
      assists: 0,
      yellow: b.yellow - a.yellow,
      red: b.red - a.red,
      pk: b.pk - a.pk,
    };
    if (Object.values(delta).some((value) => value !== 0)) result.set(id, delta);
  }
  return result;
}
