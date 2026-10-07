import "server-only";
import { cache } from "react";
import type { CardCounts } from "@/lib/comparison";
import { SEASON } from "@/lib/season";
import { TBC_TEAM } from "@/lib/teams";
import { FALLBACK_TZ } from "@/lib/timezone";
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
  MatchVideo,
  Player,
  PlayerProfile,
  Position,
  Team,
} from "@/lib/types";
import type { EventRecord, LineupRecord } from "@/lib/players";

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
  timezone: string | null;
  is_conference: boolean;
  logo_url: string | null;
  national_rank: number | null;
};

type MatchRow = {
  id: string;
  date: string;
  finished_at: string | null;
  status: MatchStatus;
  minute: number | null;
  started_at: string | null;
  home_slug: string | null;
  away_slug: string | null;
  home_placeholder: string | null;
  away_placeholder: string | null;
  home_score: number | null;
  away_score: number | null;
  home_pens: number | null;
  away_pens: number | null;
  venue: string;
  timezone: string | null;
  time_tbd: boolean;
  is_conference: boolean;
  stage: MatchStage;
  bracket_slot: string | null;
  attendance: number | null;
  referee: string | null;
  broadcast_url: string | null;
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
    timezone: row.timezone,
    isConference: row.is_conference,
    logoUrl: row.logo_url,
    nationalRank: row.national_rank,
  };
}

/** A link to the game's own stream or replay; a channel or team page is no link at all. */
function exactVideo(url: string | null): MatchVideo | undefined {
  const video = classifyVideo(url);
  return video?.exact ? video : undefined;
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
    startedAt: row.started_at ?? undefined,
    home: side(row.home_slug, row.home_placeholder, row.home_score, row.home_pens),
    away: side(row.away_slug, row.away_placeholder, row.away_score, row.away_pens),
    venue: row.venue,
    // Always a real zone, so nothing downstream has to carry a fallback.
    timezone: row.timezone ?? (row.home_slug ? teams.get(row.home_slug)?.timezone : null) ?? FALLBACK_TZ,
    timeTbd: row.time_tbd,
    isConference: row.is_conference,
    stage: row.stage,
    bracketSlot: row.bracket_slot,
    attendance: row.attendance ?? undefined,
    referee: row.referee ?? undefined,
    events: [],
    // Only the game's own stream, as the scraper matched it; never a channel page.
    video: exactVideo(row.broadcast_url),
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
        .select("slug, name, full_name, nickname, abbr, primary_color, secondary_color, location, venue, timezone, is_conference, logo_url, national_rank")
        .order("slug")
        .range(from, to),
    ),
    readAll<MatchRow>((from, to) =>
      db
        .from("matches")
        .select(
          "id, date, finished_at, status, minute, started_at, home_slug, away_slug, home_placeholder, away_placeholder, home_score, away_score, home_pens, away_pens, venue, timezone, time_tbd, is_conference, stage, bracket_slot, attendance, referee, broadcast_url, recap_url",
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

const cardCounts = cache(async (key: string): Promise<CardCounts> => {
  const db = createServerClient();
  const { data, error } = await db
    .from("match_events")
    .select("team_slug, type")
    .in("team_slug", key.split(","))
    .in("type", ["yellow", "red"])
    .like("match_id", `${SEASON}-%`);
  if (error) throw new Error(error.message);

  const counts: CardCounts = {};
  for (const row of data ?? []) {
    const slug = row.team_slug as string | null;
    if (!slug) continue;
    counts[slug] ??= { yellow: 0, red: 0 };
    counts[slug][row.type === "red" ? "red" : "yellow"] += 1;
  }
  return counts;
});

/** Yellow and red cards this season for the given teams, from the box scores we hold. */
export function getCardCounts(slugs: string[]): Promise<CardCounts> {
  return cardCounts([...slugs].sort().join(","));
}

/** The profile columns the player page reads; absent until the migration runs. */
type ProfileRow = {
  photo_url?: string | null;
  position_long?: string | null;
  weight?: string | null;
  high_school?: string | null;
  previous_school?: string | null;
  major?: string | null;
  captain?: boolean | null;
  minutes?: number | null;
  shots?: number | null;
  shots_on_goal?: number | null;
  game_winners?: number | null;
  pk_goals?: number | null;
  pk_attempts?: number | null;
  yellow_cards?: number | null;
  red_cards?: number | null;
  gk_minutes?: number | null;
  goals_against?: number | null;
  saves?: number | null;
  gk_wins?: number | null;
  gk_losses?: number | null;
  gk_ties?: number | null;
  shutouts?: number | null;
};

function toProfile(row: ProfileRow): PlayerProfile {
  return {
    photoUrl: row.photo_url ?? null,
    positionLong: row.position_long ?? null,
    weight: row.weight ?? null,
    highSchool: row.high_school ?? null,
    previousSchool: row.previous_school ?? null,
    major: row.major ?? null,
    captain: row.captain ?? false,
    minutes: row.minutes ?? null,
    shots: row.shots ?? null,
    shotsOnGoal: row.shots_on_goal ?? null,
    gameWinners: row.game_winners ?? null,
    pkGoals: row.pk_goals ?? null,
    pkAttempts: row.pk_attempts ?? null,
    yellowCards: row.yellow_cards ?? null,
    redCards: row.red_cards ?? null,
    keeper:
      row.gk_minutes != null
        ? {
            minutes: row.gk_minutes,
            goalsAgainst: row.goals_against ?? 0,
            saves: row.saves ?? 0,
            wins: row.gk_wins ?? 0,
            losses: row.gk_losses ?? 0,
            ties: row.gk_ties ?? 0,
            shutouts: row.shutouts ?? 0,
          }
        : null,
  };
}

/**
 * A player's profile and every box-score row for their team this season, for
 * the player page. `select("*")` rather than a column list, so the page still
 * renders (with less on it) before the profile migration has run.
 */
export const getPlayerDetails = cache(
  async (
    playerId: string,
    teamSlug: string,
  ): Promise<{ profile: PlayerProfile | null; lineups: LineupRecord[]; events: EventRecord[] }> => {
    const db = createServerClient();
    const [profile, lineups, events] = await Promise.all([
      db.from("players").select("*").eq("id", playerId).maybeSingle(),
      readAll<LineupRecord>((from, to) =>
        db
          .from("match_lineups")
          .select("match_id, team_slug, starter, position, player_name, player_id")
          .eq("team_slug", teamSlug)
          .like("match_id", `${SEASON}-%`)
          .order("id")
          .range(from, to),
      ),
      readAll<EventRecord>((from, to) =>
        db
          .from("match_events")
          .select("match_id, minute, type, team_slug, player_name, player_id, assist_name, assist_player_id")
          .eq("team_slug", teamSlug)
          .like("match_id", `${SEASON}-%`)
          .order("id")
          .range(from, to),
      ),
    ]);
    if (profile.error) throw new Error(profile.error.message);

    return { profile: profile.data ? toProfile(profile.data as ProfileRow) : null, lineups, events };
  },
);
