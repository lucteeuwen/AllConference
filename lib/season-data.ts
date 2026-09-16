import "server-only";
import { cache } from "react";
import { SEASON } from "@/lib/season";
import { TBC_TEAM } from "@/lib/teams";
import { createServerClient } from "@/lib/supabase/server";
import { classifyVideo } from "@/lib/video";
import type {
  Bracket,
  BracketSlotId,
  Lineup,
  Match,
  MatchEvent,
  MatchStage,
  MatchStatus,
  Player,
  Position,
  Team,
} from "@/lib/types";

/**
 * The one place that talks to Supabase. Everything a page shows is loaded
 * here once per request (React `cache`) and mapped onto `lib/types.ts`.
 * Events and lineups are only needed on a match page, so they load per match.
 */

export type SeasonData = {
  teams: Team[];
  conference: Team[];
  matches: Match[];
  players: Player[];
  bracket: Bracket;
};

type TeamRow = {
  slug: string;
  name: string;
  full_name: string;
  nickname: string;
  abbr: string;
  primary_color: string;
  secondary_color: string;
  location: string;
  venue: string;
  is_conference: boolean;
  logo_url: string | null;
};

type MatchRow = {
  id: string;
  date: string;
  finished_at: string | null;
  status: MatchStatus;
  minute: number | null;
  home_slug: string | null;
  away_slug: string | null;
  home_placeholder: string | null;
  away_placeholder: string | null;
  home_score: number | null;
  away_score: number | null;
  home_pens: number | null;
  away_pens: number | null;
  venue: string;
  is_conference: boolean;
  stage: MatchStage;
  bracket_slot: string | null;
  attendance: number | null;
  referee: string | null;
  video_url: string | null;
  boxscore_url: string | null;
  recap_url: string | null;
};

type PlayerRow = {
  id: string;
  team_slug: string;
  number: number | null;
  name: string;
  position: string | null;
  year: string;
  hometown: string;
  height: string;
  gp: number;
  gs: number;
  goals: number;
  assists: number;
};

const PAGE = 1000;

/** PostgREST caps a response at 1000 rows, so read in pages. */
async function readAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

function toTeam(row: TeamRow): Team {
  return {
    slug: row.slug,
    name: row.name,
    fullName: row.full_name,
    nickname: row.nickname,
    primary: row.primary_color,
    secondary: row.secondary_color,
    abbr: row.abbr,
    location: row.location,
    venue: row.venue,
    isConference: row.is_conference,
    logoUrl: row.logo_url,
  };
}

function toMatch(row: MatchRow, teams: Map<string, Team>): Match {
  const side = (slug: string | null, placeholder: string | null, score: number | null, pens: number | null) => ({
    teamSlug: slug,
    team: (slug && teams.get(slug)) || TBC_TEAM,
    placeholder: slug ? undefined : (placeholder ?? "TBC"),
    score,
    pens,
  });

  return {
    id: row.id,
    date: row.date,
    finishedAt: row.finished_at,
    status: row.status,
    minute: row.minute ?? undefined,
    home: side(row.home_slug, row.home_placeholder, row.home_score, row.home_pens),
    away: side(row.away_slug, row.away_placeholder, row.away_score, row.away_pens),
    venue: row.venue,
    isConference: row.is_conference,
    stage: row.stage,
    bracketSlot: row.bracket_slot,
    attendance: row.attendance ?? undefined,
    referee: row.referee ?? undefined,
    events: [],
    video: classifyVideo(row.video_url),
    boxscoreUrl: row.boxscore_url ?? undefined,
    recapUrl: row.recap_url ?? undefined,
  };
}

const POSITIONS = new Set<Position>(["GK", "D", "M", "F"]);

export const getSeasonData = cache(async (): Promise<SeasonData> => {
  const db = createServerClient();

  const [teamRows, matchRows, playerRows, slotRows, seedRows] = await Promise.all([
    readAll<TeamRow>((from, to) =>
      db
        .from("teams")
        .select("slug, name, full_name, nickname, abbr, primary_color, secondary_color, location, venue, is_conference, logo_url")
        .order("slug")
        .range(from, to),
    ),
    readAll<MatchRow>((from, to) =>
      db
        .from("matches")
        .select(
          "id, date, finished_at, status, minute, home_slug, away_slug, home_placeholder, away_placeholder, home_score, away_score, home_pens, away_pens, venue, is_conference, stage, bracket_slot, attendance, referee, video_url, boxscore_url, recap_url",
        )
        .eq("season", SEASON)
        .order("date")
        .order("id")
        .range(from, to),
    ),
    readAll<PlayerRow>((from, to) =>
      db
        .from("players")
        .select("id, team_slug, number, name, position, year, hometown, height, gp, gs, goals, assists")
        .eq("season", SEASON)
        .order("id")
        .range(from, to),
    ),
    readAll<{
      slot: BracketSlotId;
      round: "quarterfinal" | "semifinal" | "final";
      home_seed: number | null;
      away_seed: number | null;
      home_from: BracketSlotId | null;
      away_from: BracketSlotId | null;
      match_id: string | null;
    }>((from, to) => db.from("bracket_slots").select("*").eq("season", SEASON).range(from, to)),
    readAll<{ seed: number; team_slug: string; is_official: boolean }>((from, to) =>
      db.from("bracket_seeds").select("seed, team_slug, is_official").eq("season", SEASON).range(from, to),
    ),
  ]);

  const teams = teamRows.map(toTeam);
  const index = new Map(teams.map((team) => [team.slug, team]));

  return {
    teams,
    conference: teams.filter((team) => team.isConference),
    matches: matchRows.map((row) => toMatch(row, index)),
    players: playerRows.map((row) => ({
      id: row.id,
      teamSlug: row.team_slug,
      number: row.number,
      name: row.name,
      position: POSITIONS.has(row.position as Position) ? (row.position as Position) : null,
      year: row.year,
      hometown: row.hometown,
      height: row.height,
      stats: { gp: row.gp, gs: row.gs, goals: row.goals, assists: row.assists },
    })),
    bracket: {
      season: SEASON,
      seeds: Object.fromEntries(seedRows.map((row) => [row.seed, row.team_slug])),
      official: seedRows.length > 0 && seedRows.every((row) => row.is_official),
      slots: slotRows
        .map((row) => ({
          slot: row.slot,
          round: row.round,
          homeSeed: row.home_seed,
          awaySeed: row.away_seed,
          homeFrom: row.home_from,
          awayFrom: row.away_from,
          matchId: row.match_id,
        }))
        .sort((a, b) => ["qf1", "qf2", "sf1", "sf2", "final"].indexOf(a.slot) - ["qf1", "qf2", "sf1", "sf2", "final"].indexOf(b.slot)),
    },
  };
});

/** Timeline and lineups for one match. */
export const getMatchDetails = cache(
  async (matchId: string): Promise<{ events: MatchEvent[]; lineups?: { home: Lineup; away: Lineup } }> => {
    const db = createServerClient();
    const [events, lineups] = await Promise.all([
      db
        .from("match_events")
        .select("minute, type, team_slug, player_name, assist_name, sort")
        .eq("match_id", matchId)
        .order("sort"),
      db
        .from("match_lineups")
        .select("side, starter, number, player_name, position, sort")
        .eq("match_id", matchId)
        .order("sort"),
    ]);
    if (events.error) throw new Error(events.error.message);
    if (lineups.error) throw new Error(lineups.error.message);

    const lineup = (side: "home" | "away"): Lineup => {
      const rows = (lineups.data ?? []).filter((row) => row.side === side);
      const entry = (row: (typeof rows)[number]) => ({
        name: row.player_name as string,
        number: row.number as number | null,
        position: row.position as string | null,
      });
      return {
        starters: rows.filter((row) => row.starter).map(entry),
        subs: rows.filter((row) => !row.starter).map(entry),
      };
    };

    return {
      events: (events.data ?? []).map((row) => ({
        minute: row.minute,
        type: row.type,
        teamSlug: row.team_slug,
        playerName: row.player_name,
        assistName: row.assist_name ?? undefined,
      })),
      lineups: lineups.data && lineups.data.length > 0 ? { home: lineup("home"), away: lineup("away") } : undefined,
    };
  },
);

/** A match with its timeline and lineups filled in. */
export async function withDetails(match: Match): Promise<Match> {
  const details = await getMatchDetails(match.id);
  return { ...match, events: details.events, lineups: details.lineups };
}
