import { computeStandings, goalDifference } from "@/lib/standings";
import type { Match, Player, Result, StandingsRow, Team } from "@/lib/types";

/**
 * Everything we know about the two teams in a match, laid out side by side.
 * Pure, so it can be tested without a database: the page hands in the season's
 * matches, the rosters, the conference table and the card counts.
 */

export type StatRow = {
  label: string;
  home: string;
  away: string;
  /** Numbers behind the two texts, when they can be compared on a bar. */
  homeValue?: number;
  awayValue?: number;
  /** Whether the bigger number is the better one. */
  better?: "higher" | "lower";
};

export type StatGroup = { title: string; note?: string; rows: StatRow[] };

export type Comparison = {
  groups: StatGroup[];
  form: { home: Result[]; away: Result[] };
  /** The other meetings of these two teams this season. */
  headToHead: Match[];
};

export type CardCounts = Record<string, { yellow: number; red: number }>;

export type ComparisonInput = {
  home: Team;
  away: Team;
  matchId: string;
  matches: Match[];
  players: Player[];
  /** Conference rank by slug, in the order the standings table shows. */
  ranks: Record<string, number>;
  /** Conference records by slug; only conference teams appear. */
  conference: Record<string, StandingsRow["conference"]>;
  conferenceStarted: boolean;
  cards?: CardCounts;
};

const DASH = "—";

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

const record = (w: number, d: number, l: number) => `${w}-${d}-${l}`;
const perGame = (value: number, games: number) => (games > 0 ? value / games : 0);
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

type Facts = {
  games: number;
  row: StandingsRow;
  cleanSheets: number;
};

function factsFor(slug: string, matches: Match[], row: StandingsRow): Facts {
  const played = matches.filter(
    (match) =>
      match.status === "final" &&
      match.home.score !== null &&
      match.away.score !== null &&
      (match.home.teamSlug === slug || match.away.teamSlug === slug),
  );
  const cleanSheets = played.filter((match) =>
    (match.home.teamSlug === slug ? match.away.score : match.home.score) === 0,
  ).length;
  return { games: row.overall.w + row.overall.d + row.overall.l, row, cleanSheets };
}

function topBy(players: Player[], slug: string, pick: (player: Player) => number) {
  const best = players
    .filter((player) => player.teamSlug === slug && pick(player) > 0)
    .sort(
      (a, b) =>
        pick(b) - pick(a) ||
        b.stats.goals * 2 + b.stats.assists - (a.stats.goals * 2 + a.stats.assists) ||
        a.name.localeCompare(b.name),
    )[0];
  return best;
}

export function compareTeams(input: ComparisonInput): Comparison {
  const { home, away, matches, players } = input;
  const slugs = [home.slug, away.slug];

  // Both teams' rows come from the same reducer as the standings table.
  const table = computeStandings(matches, slugs, (slug) => (slug === home.slug ? home.name : away.name));
  const rowOf = (slug: string) => table.find((row) => row.teamSlug === slug) as StandingsRow;
  const h = factsFor(home.slug, matches, rowOf(home.slug));
  const a = factsFor(away.slug, matches, rowOf(away.slug));

  /** A row of whole numbers. */
  const count = (
    label: string,
    homeValue: number,
    awayValue: number,
    better: "higher" | "lower",
    format: (value: number) => string = String,
  ): StatRow => ({
    label,
    home: format(homeValue),
    away: format(awayValue),
    homeValue,
    awayValue,
    better,
  });

  /** A row of averages, which read as a dash for a team with no games yet. */
  const average = (
    label: string,
    homeValue: number,
    awayValue: number,
    better: "higher" | "lower",
    format: (value: number) => string,
  ): StatRow => ({
    label,
    home: h.games > 0 ? format(homeValue) : DASH,
    away: a.games > 0 ? format(awayValue) : DASH,
    homeValue,
    awayValue,
    better,
  });

  const season: StatGroup = {
    title: "Season so far",
    note: "All games played this season, conference and non-conference.",
    rows: [
      count("Games played", h.games, a.games, "higher"),
      {
        label: "Record (W-D-L)",
        home: record(h.row.overall.w, h.row.overall.d, h.row.overall.l),
        away: record(a.row.overall.w, a.row.overall.d, a.row.overall.l),
      },
      count("Points", h.row.overall.pts, a.row.overall.pts, "higher"),
      average(
        "Points per game",
        perGame(h.row.overall.pts, h.games),
        perGame(a.row.overall.pts, a.games),
        "higher",
        (value) => value.toFixed(2),
      ),
      average(
        "Win rate",
        perGame(h.row.overall.w, h.games),
        perGame(a.row.overall.w, a.games),
        "higher",
        (value) => `${Math.round(value * 100)}%`,
      ),
    ],
  };

  const scoring: StatGroup = {
    title: "Scoring",
    rows: [
      count("Goals scored", h.row.overall.gf, a.row.overall.gf, "higher"),
      count("Goals conceded", h.row.overall.ga, a.row.overall.ga, "lower"),
      count("Goal difference", goalDifference(h.row.overall), goalDifference(a.row.overall), "higher", signed),
      average(
        "Goals per game",
        perGame(h.row.overall.gf, h.games),
        perGame(a.row.overall.gf, a.games),
        "higher",
        (value) => value.toFixed(2),
      ),
      average(
        "Conceded per game",
        perGame(h.row.overall.ga, h.games),
        perGame(a.row.overall.ga, a.games),
        "lower",
        (value) => value.toFixed(2),
      ),
      count("Clean sheets", h.cleanSheets, a.cleanSheets, "higher"),
    ],
  };

  const split = (row: StandingsRow, side: "home" | "away") => {
    const r = row[side];
    return { text: `${record(r.w, r.d, r.l)} (${r.gf}-${r.ga})`, games: r.w + r.d + r.l, points: r.pts };
  };
  const venue = (label: string, side: "home" | "away"): StatRow => {
    const x = split(h.row, side);
    const y = split(a.row, side);
    return {
      label,
      home: x.games > 0 ? x.text : DASH,
      away: y.games > 0 ? y.text : DASH,
      homeValue: perGame(x.points, x.games),
      awayValue: perGame(y.points, y.games),
      better: "higher",
    };
  };
  const homeAway: StatGroup = {
    title: "Home and away",
    note: "W-D-L, with goals for and against in brackets. Bars compare points per game.",
    rows: [venue("At home", "home"), venue("Away from home", "away")],
  };

  const groups: StatGroup[] = [season, scoring, homeAway];

  const inConference = (slug: string) => input.conference[slug] !== undefined;
  if (inConference(home.slug) || inConference(away.slug)) {
    const rank = (slug: string) => input.ranks[slug];
    const standing = (slug: string) =>
      inConference(slug) && rank(slug) ? `${ordinal(rank(slug))}${input.conferenceStarted ? "" : " (by form)"}` : DASH;
    const conf = (slug: string) => input.conference[slug];
    const confRecord = (slug: string) => (conf(slug) ? record(conf(slug).w, conf(slug).d, conf(slug).l) : DASH);
    groups.push({
      title: "CCIW",
      rows: [
        {
          label: "Conference standing",
          home: standing(home.slug),
          away: standing(away.slug),
          homeValue: inConference(home.slug) ? rank(home.slug) : undefined,
          awayValue: inConference(away.slug) ? rank(away.slug) : undefined,
          better: "lower",
        },
        { label: "Conference record", home: confRecord(home.slug), away: confRecord(away.slug) },
        {
          label: "Conference points",
          home: conf(home.slug) ? String(conf(home.slug).pts) : DASH,
          away: conf(away.slug) ? String(conf(away.slug).pts) : DASH,
          homeValue: conf(home.slug)?.pts,
          awayValue: conf(away.slug)?.pts,
          better: "higher",
        },
      ],
    });
  }

  const rosterSize = (slug: string) => players.filter((player) => player.teamSlug === slug).length;
  if (rosterSize(home.slug) > 0 || rosterSize(away.slug) > 0) {
    const scorer = (slug: string) => {
      const p = topBy(players, slug, (player) => player.stats.goals);
      return p ? `${p.name} · ${p.stats.goals}\u00a0G` : DASH;
    };
    const assister = (slug: string) => {
      const p = topBy(players, slug, (player) => player.stats.assists);
      return p ? `${p.name} · ${p.stats.assists}\u00a0A` : DASH;
    };
    groups.push({
      title: "Squad",
      rows: [
        { label: "Top scorer", home: scorer(home.slug), away: scorer(away.slug) },
        { label: "Most assists", home: assister(home.slug), away: assister(away.slug) },
        {
          label: "Players on the roster",
          home: rosterSize(home.slug) > 0 ? String(rosterSize(home.slug)) : DASH,
          away: rosterSize(away.slug) > 0 ? String(rosterSize(away.slug)) : DASH,
        },
      ],
    });
  }

  if (input.cards) {
    const cards = input.cards;
    const cardsOf = (slug: string, kind: "yellow" | "red") => cards[slug]?.[kind] ?? 0;
    groups.push({
      title: "Discipline",
      note: "Counted from the published box scores.",
      rows: [
        count("Yellow cards", cardsOf(home.slug, "yellow"), cardsOf(away.slug, "yellow"), "lower"),
        count("Red cards", cardsOf(home.slug, "red"), cardsOf(away.slug, "red"), "lower"),
      ],
    });
  }

  const text = (label: string, homeText: string, awayText: string): StatRow[] =>
    homeText || awayText ? [{ label, home: homeText || DASH, away: awayText || DASH }] : [];
  groups.push({
    title: "The clubs",
    rows: [
      ...text("Based in", home.location, away.location),
      ...text("Nickname", home.nickname, away.nickname),
      ...text("Home ground", home.venue, away.venue),
    ],
  });

  const headToHead = matches.filter(
    (match) =>
      match.id !== input.matchId &&
      match.status !== "canceled" &&
      slugs.includes(match.home.teamSlug ?? "") &&
      slugs.includes(match.away.teamSlug ?? "") &&
      match.home.teamSlug !== match.away.teamSlug,
  );

  return {
    groups: groups.filter((group) => group.rows.length > 0),
    form: { home: h.row.form, away: a.row.form },
    headToHead,
  };
}
