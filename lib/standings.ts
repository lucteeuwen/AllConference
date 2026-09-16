import type { RecordLine, StandingsRow } from "@/lib/types";

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
