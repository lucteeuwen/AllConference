import type { RecordLine, StandingsRow, StandingsSplit } from "@/lib/types";

/**
 * The table reducer, kept free of any data source so the site and the scraper
 * (which projects tournament seeds from it) rank teams the same way.
 */

/** The minimum a match needs to count towards the table. */
export type TableMatch = {
  status: string;
  isConference: boolean;
  home: { teamSlug: string | null; score: number | null };
  away: { teamSlug: string | null; score: number | null };
};

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

/** Points earned across a form guide's results: three for a win, one for a draw. */
export function formPoints(form: StandingsRow["form"]): number {
  return form.reduce((sum, result) => sum + (result === "W" ? 3 : result === "D" ? 1 : 0), 0);
}

/** Best recent form first; goal difference and goals scored settle ties. */
export function compareByForm(a: StandingsRow, b: StandingsRow): number {
  return (
    formPoints(b.form) - formPoints(a.form) ||
    goalDifference(b.overall) - goalDifference(a.overall) ||
    b.overall.gf - a.overall.gf
  );
}

/** The columns of the table that can be sorted, besides form and the standing itself. */
export type SortColumn = "pts" | "w" | "l" | "d" | "gf" | "ga" | "gd";
export type SortKey = "rank" | "form" | SortColumn;

/**
 * The record a split shows. "All" is the conference record once conference play
 * has started, which is what the standings rank on; before that every team sits
 * on zero, so it shows every game played so far instead.
 */
export function recordFor(
  row: StandingsRow,
  split: StandingsSplit,
  conferenceStarted: boolean,
): RecordLine {
  if (split === "home") return row.home;
  if (split === "away") return row.away;
  return conferenceStarted ? row.conference : row.overall;
}

export function columnValue(record: RecordLine, column: SortColumn): number {
  switch (column) {
    case "pts":
      return record.pts;
    case "w":
      return record.w;
    case "l":
      return record.l;
    case "d":
      return record.d;
    case "gf":
      return record.gf;
    case "ga":
      return record.ga;
    case "gd":
      return goalDifference(record);
  }
}

/** Fewer is better for these, so they sort ascending; everything else, descending. */
const lowerIsBetter: ReadonlySet<SortColumn> = new Set(["l", "ga"]);

/**
 * Orders table entries, which arrive already in standing order (`rank` order).
 * "rank" keeps that order, "form" ranks by recent form whatever the split, and a
 * column ranks by the record the split shows. Ties keep their incoming order,
 * so every sort is stable and predictable.
 */
export function sortEntries<T extends { row: StandingsRow }>(
  entries: T[],
  sort: SortKey,
  split: StandingsSplit,
  conferenceStarted: boolean,
): T[] {
  if (sort === "rank") return entries;

  const order = new Map(entries.map((entry, index) => [entry, index]));
  const byRank = (a: T, b: T) => (order.get(a) ?? 0) - (order.get(b) ?? 0);

  if (sort === "form") {
    return [...entries].sort((a, b) => compareByForm(a.row, b.row) || byRank(a, b));
  }

  const direction = lowerIsBetter.has(sort) ? -1 : 1;
  const valueOf = (entry: T) => columnValue(recordFor(entry.row, split, conferenceStarted), sort);
  return [...entries].sort((a, b) => direction * (valueOf(b) - valueOf(a)) || byRank(a, b));
}

/**
 * Builds the table from finished matches rather than storing it, so the numbers
 * always agree with the fixture list. Three points for a win, one for a draw.
 * `matches` must be in date order for the form guide to read correctly.
 */
export function computeStandings(
  matches: TableMatch[],
  conferenceSlugs: string[],
  nameOf: (slug: string) => string,
): StandingsRow[] {
  const members = new Set(conferenceSlugs);
  const rows = new Map<string, StandingsRow>(
    conferenceSlugs.map((slug) => [
      slug,
      {
        teamSlug: slug,
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
    const conference =
      match.isConference &&
      members.has(match.home.teamSlug ?? "") &&
      members.has(match.away.teamSlug ?? "");

    for (const side of ["home", "away"] as const) {
      const row = rows.get(match[side].teamSlug ?? "");
      if (!row) continue;

      const own = match[side].score as number;
      const other = (side === "home" ? match.away.score : match.home.score) as number;

      addResult(row.overall, own, other);
      addResult(row[side], own, other);
      if (conference) addResult(row.conference, own, other);
      row.form.push(own > other ? "W" : own < other ? "L" : "D");
    }
  }

  return [...rows.values()]
    .map((row) => ({ ...row, form: row.form.slice(-5) }))
    .sort(
      (a, b) =>
        b.conference.pts - a.conference.pts ||
        goalDifference(b.conference) - goalDifference(a.conference) ||
        b.conference.gf - a.conference.gf ||
        nameOf(a.teamSlug).localeCompare(nameOf(b.teamSlug)),
    );
}
