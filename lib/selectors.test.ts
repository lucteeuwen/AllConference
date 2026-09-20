import { describe, expect, it } from "vitest";
import { tableView, type StandingsLine } from "@/lib/selectors";
import { recordFor } from "@/lib/standings";
import type { RecordLine, Result, StandingsRow, Team } from "@/lib/types";

const record = (w = 0, l = 0, d = 0, gf = 0, ga = 0): RecordLine => ({ w, l, d, gf, ga, pts: w * 3 + d });

function line(slug: string, rank: number, parts: { conference?: RecordLine; overall?: RecordLine; form?: Result[] }): StandingsLine {
  const row: StandingsRow = {
    teamSlug: slug,
    conference: parts.conference ?? record(),
    overall: parts.overall ?? record(),
    home: record(),
    away: record(),
    form: parts.form ?? [],
  };
  return { row, team: { slug, name: slug } as Team, rank };
}

describe("tableView", () => {
  // Points order as computeStandings would hand it over: everyone on 0 conference points, so by name.
  const beforeConference = [
    line("a", 1, { overall: record(0, 3, 0), form: ["L", "L", "L"] }),
    line("b", 2, { overall: record(3, 0, 0, 9, 0), form: ["W", "W", "W"] }),
    line("c", 3, { overall: record(1, 1, 1), form: ["W", "L", "D"] }),
  ];

  it("orders by form and re-ranks 1..n until the first conference game", () => {
    const view = tableView(beforeConference);
    expect(view.started).toBe(false);
    expect(view.lines.map((l) => [l.team.slug, l.rank])).toEqual([["b", 1], ["c", 2], ["a", 3]]);
  });

  it("keeps the points order once a conference game has been played", () => {
    const started = [
      line("x", 1, { conference: record(1, 0, 0, 2, 0) }),
      line("y", 2, { conference: record(0, 1, 0, 0, 2) }),
    ];
    const view = tableView(started);
    expect(view.started).toBe(true);
    expect(view.lines).toBe(started);
  });

  it("gives every row the record the Standings page shows: overall before the start, conference after", () => {
    const view = tableView(beforeConference);
    const shown = view.lines.map((l) => recordFor(l.row, "all", view.started).pts);
    expect(shown).toEqual([9, 4, 0]);

    const after = tableView([line("x", 1, { conference: record(1), overall: record(5) })]);
    expect(recordFor(after.lines[0].row, "all", after.started).pts).toBe(3);
  });
});
