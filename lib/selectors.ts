import type { SeasonData } from "@/lib/season-data";
import {
  compareByForm,
  computeStandings as reduceStandings,
  goalDifference,
  played,
} from "@/lib/standings";
import type {
  Match,
  Player,
  Position,
  RecordLine,
  Result,
  StandingsRow,
  StandingsSplit,
  Team,
} from "@/lib/types";

/**
 * Derived views over one loaded season. Pages call `getSeasonData()` once and
 * pass the result in, so nothing here touches the database.
 */

export { goalDifference, played };

export function getTeam(data: SeasonData, slug: string): Team | undefined {
  return data.teams.find((team) => team.slug === slug);
}

export function getMatch(data: SeasonData, id: string): Match | undefined {
  return data.matches.find((match) => match.id === id);
}

const positionRank: Record<Position, number> = { GK: 0, D: 1, M: 2, F: 3 };

export function getRoster(data: SeasonData, slug: string): Player[] {
  return data.players
    .filter((player) => player.teamSlug === slug)
    .sort(
      (a, b) =>
        (a.number ?? 999) - (b.number ?? 999) ||
        (a.position ? positionRank[a.position] : 9) - (b.position ? positionRank[b.position] : 9) ||
        a.name.localeCompare(b.name),
    );
}

export type ScorerLine = {
  player: Player;
  team: Team;
  points: number;
};

/**
 * Conference scoring leaders. Points follow the NCAA convention of two for a
 * goal and one for an assist, which is how college soccer ranks its leaders.
 * These are season totals, non-conference games included, as the schools
 * publish them.
 */
function rankScorers(data: SeasonData, keep: (player: Player) => boolean): ScorerLine[] {
  const teams = new Map(data.conference.map((team) => [team.slug, team]));
  return data.players
    .flatMap((player) => {
      const team = teams.get(player.teamSlug);
      return team && keep(player)
        ? [{ player, team, points: player.stats.goals * 2 + player.stats.assists }]
        : [];
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.player.stats.goals - a.player.stats.goals ||
        a.player.name.localeCompare(b.player.name),
    );
}

export function getTopScorers(data: SeasonData, limit = 5): ScorerLine[] {
  return rankScorers(data, (player) => player.stats.goals * 2 + player.stats.assists > 0).slice(0, limit);
}

/** Every conference player with at least one goal, ranked like the leaders. */
export function getGoalScorers(data: SeasonData): ScorerLine[] {
  return rankScorers(data, (player) => player.stats.goals >= 1);
}

export function matchesForTeam(data: SeasonData, slug: string): Match[] {
  return data.matches.filter(
    (match) => match.home.teamSlug === slug || match.away.teamSlug === slug,
  );
}

/** Result of a finished match from one team's point of view. */
export function resultFor(match: Match, slug: string): Result | null {
  if (match.status !== "final" || match.home.score === null || match.away.score === null) {
    return null;
  }
  const isHome = match.home.teamSlug === slug;
  const own = isHome ? match.home.score : match.away.score;
  const other = isHome ? match.away.score : match.home.score;
  if (own > other) return "W";
  if (own < other) return "L";
  return "D";
}

export function computeStandings(data: SeasonData): StandingsRow[] {
  const names = new Map(data.teams.map((team) => [team.slug, team.name]));
  return reduceStandings(
    data.matches,
    data.conference.map((team) => team.slug),
    (slug) => names.get(slug) ?? slug,
  );
}

export type StandingsLine = {
  row: StandingsRow;
  team: Team;
  rank: number;
};

export function standingsLines(data: SeasonData): StandingsLine[] {
  const teams = new Map(data.teams.map((team) => [team.slug, team]));
  return computeStandings(data).flatMap((row, index) => {
    const team = teams.get(row.teamSlug);
    return team ? [{ row, team, rank: index + 1 }] : [];
  });
}

/** False until the first conference match has been played. */
export function conferenceStarted(lines: StandingsLine[]): boolean {
  return lines.some((line) => played(line.row.conference) > 0);
}

/**
 * The table as readers see it: by points once conference play is under way,
 * by recent form (re-ranked 1..n) until then, when every team sits on zero.
 */
export function displayStandings(lines: StandingsLine[]): StandingsLine[] {
  if (conferenceStarted(lines)) return lines;
  return [...lines]
    .sort((a, b) => compareByForm(a.row, b.row))
    .map((line, index) => ({ ...line, rank: index + 1 }));
}

export function recordForSplit(row: StandingsRow, split: StandingsSplit): RecordLine {
  return split === "home" ? row.home : split === "away" ? row.away : row.conference;
}

export type DayGroup = {
  key: string;
  matches: Match[];
};

/**
 * `dayOf` is injected because which day a match falls on depends on the zone
 * it is read in, which only the browser knows. See `matchDayKey`.
 */
export function groupMatchesByDate(list: Match[], dayOf: (match: Match) => string): DayGroup[] {
  const groups = new Map<string, DayGroup>();

  for (const match of [...list].sort((a, b) => a.date.localeCompare(b.date))) {
    const key = dayOf(match);
    const group = groups.get(key);
    if (group) {
      group.matches.push(match);
    } else {
      groups.set(key, { key, matches: [match] });
    }
  }

  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Label for a match's competition, used on cards and the match page. */
export function competitionLabel(match: Match, long = false): string {
  switch (match.stage) {
    case "quarterfinal":
      return "CCIW Tournament · Quarterfinal";
    case "semifinal":
      return "CCIW Tournament · Semifinal";
    case "final":
      return "CCIW Tournament · Final";
    case "ncaa":
      return "NCAA Tournament";
    default:
      return match.isConference ? (long ? "CCIW Conference" : "CCIW") : "Non-conference";
  }
}

/**
 * Trims a match to what a list row renders. The whole season crosses to the
 * browser on /matches so it can be regrouped in the reader's zone, and these
 * four fields are only ever read on a match's own page.
 */
export function slimForList(match: Match): Match {
  const slim = { ...match };
  delete slim.video;
  delete slim.boxscoreUrl;
  delete slim.recapUrl;
  delete slim.lineups;
  return slim;
}
