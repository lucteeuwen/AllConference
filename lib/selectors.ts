import { allTeams, conferenceSlugs, teams } from "@/lib/data/teams";
import { matches } from "@/lib/data/matches";
import { rosters, playersById } from "@/lib/data/rosters";
import { dayKey } from "@/lib/data/season";
import type {
  Match,
  Player,
  RecordLine,
  Result,
  StandingsRow,
  StandingsSplit,
  Team,
} from "@/lib/types";

/** Single read path for every page. Swapping in a live backend stops here. */

const teamIndex = new Map(allTeams.map((team) => [team.slug, team]));

export function getTeam(slug: string): Team | undefined {
  return teamIndex.get(slug);
}

/** Falls back to a grey placeholder so an unknown opponent never crashes a page. */
export function requireTeam(slug: string): Team {
  return (
    teamIndex.get(slug) ?? {
      slug,
      name: slug,
      fullName: slug,
      nickname: "",
      primary: "#6b7280",
      secondary: "#ffffff",
      abbr: slug.slice(0, 3).toUpperCase(),
      location: "",
      venue: "",
    }
  );
}

export function getAllMatches(): Match[] {
  return matches;
}

export function getMatch(id: string): Match | undefined {
  return matches.find((match) => match.id === id);
}

export function getConferenceTeams(): Team[] {
  return teams;
}

export function getRoster(slug: string): Player[] {
  return [...(rosters[slug] ?? [])].sort((a, b) => a.number - b.number);
}

export function getPlayer(id: string): Player | undefined {
  return playersById[id];
}

export function matchesForTeam(slug: string): Match[] {
  return matches.filter(
    (match) => match.home.teamSlug === slug || match.away.teamSlug === slug,
  );
}

export function getLiveMatches(): Match[] {
  return matches.filter((match) => match.status === "live");
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

function emptyRecord(): RecordLine {
  return { w: 0, l: 0, d: 0, pts: 0, gf: 0, ga: 0 };
}

function addResult(record: RecordLine, own: number, other: number): void {
  record.gf += own;
  record.ga += other;
  if (own > other) {
    record.w += 1;
    record.pts += 3;
  } else if (own < other) {
    record.l += 1;
  } else {
    record.d += 1;
    record.pts += 1;
  }
}

export function played(record: RecordLine): number {
  return record.w + record.l + record.d;
}

export function goalDifference(record: RecordLine): number {
  return record.gf - record.ga;
}

/**
 * Builds the table from finished matches rather than storing it, so the numbers
 * stay consistent with the fixture list and the reducer survives the move to
 * scraped data. Three points for a win, one for a draw. Postponed and scheduled
 * matches are ignored.
 */
export function computeStandings(): StandingsRow[] {
  const rows = new Map<string, StandingsRow>(
    teams.map((team) => [
      team.slug,
      {
        teamSlug: team.slug,
        conference: emptyRecord(),
        overall: emptyRecord(),
        home: emptyRecord(),
        away: emptyRecord(),
        form: [],
      },
    ]),
  );

  for (const match of matches) {
    if (match.status !== "final" || match.home.score === null || match.away.score === null) {
      continue;
    }

    for (const side of ["home", "away"] as const) {
      const slug = match[side].teamSlug;
      const row = rows.get(slug);
      if (!row) continue;

      const own = match[side].score as number;
      const other = (side === "home" ? match.away.score : match.home.score) as number;

      addResult(row.overall, own, other);
      addResult(row[side], own, other);
      if (match.isConference && conferenceSlugs.has(match.home.teamSlug) && conferenceSlugs.has(match.away.teamSlug)) {
        addResult(row.conference, own, other);
      }
      row.form.push(own > other ? "W" : own < other ? "L" : "D");
    }
  }

  return [...rows.values()]
    .map((row) => ({ ...row, form: row.form.slice(-5) }))
    .sort(compareStandings);
}

/** Conference points, then goal difference, then goals for, then name. */
function compareStandings(a: StandingsRow, b: StandingsRow): number {
  return (
    b.conference.pts - a.conference.pts ||
    goalDifference(b.conference) - goalDifference(a.conference) ||
    b.conference.gf - a.conference.gf ||
    requireTeam(a.teamSlug).name.localeCompare(requireTeam(b.teamSlug).name)
  );
}

export function recordForSplit(row: StandingsRow, split: StandingsSplit): RecordLine {
  return split === "home" ? row.home : split === "away" ? row.away : row.conference;
}

export type DayGroup = {
  key: string;
  /** Kickoff of the first match that day, for heading formatting. */
  iso: string;
  matches: Match[];
};

export function groupMatchesByDate(list: Match[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();

  for (const match of [...list].sort((a, b) => a.date.localeCompare(b.date))) {
    const key = dayKey(match.date);
    const group = groups.get(key);
    if (group) {
      group.matches.push(match);
    } else {
      groups.set(key, { key, iso: match.date, matches: [match] });
    }
  }

  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}
