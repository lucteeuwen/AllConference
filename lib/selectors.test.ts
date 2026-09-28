import { describe, expect, it } from "vitest";
import { getScorersBy, getTopScorers, tableView, type StandingsLine } from "@/lib/selectors";
import { recordFor } from "@/lib/standings";
import type { SeasonData } from "@/lib/season-data";
import type { Player, RecordLine, Result, StandingsRow, Team } from "@/lib/types";

const record = (w = 0, l = 0, d = 0, gf = 0, ga = 0): RecordLine => ({ w, l, d, gf, ga, pts: w * 3 + d });

function line(slug: string, rank: number, parts: { conference?: RecordLine; overall?: RecordLine; form?: Result[] }): StandingsLine {
  const row: StandingsRow = {
    teamSlug: slug,
    conference: parts.conference ?? record(),
    overall: parts.overall ?? record(),
    home: record(),
    away: record(),
    homeConference: record(),
    awayConference: record(),
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

describe("scoring leaders", () => {
  const player = (name: string, goals: number, assists: number, teamSlug = "a"): Player =>
    ({ id: name, name, teamSlug, stats: { gp: 0, gs: 0, goals, assists } }) as Player;
  const data = {
    conference: [{ slug: "a", name: "a" }],
    players: [
      player("Cy", 2, 5),
      player("Al", 5, 0),
      player("Bo", 5, 1),
      player("Di", 0, 5),
      player("Ed", 0, 0),
      player("Fay", 2, 2),
      player("Outsider", 9, 9, "elsewhere"),
    ],
  } as unknown as SeasonData;
  const names = (lines: { player: Player }[]) => lines.map((l) => l.player.name).join(",");

  it("ranks goals first, then assists, then name", () => {
    expect(names(getScorersBy(data, "goals"))).toBe("Bo,Al,Cy,Fay");
  });

  it("ranks assists first, then goals, then name", () => {
    expect(names(getScorersBy(data, "assists"))).toBe("Cy,Di,Fay,Bo");
  });

  it("keeps only conference players with at least one of the stat", () => {
    expect(names(getScorersBy(data, "goals"))).not.toContain("Di");
    expect(names(getScorersBy(data, "assists"))).not.toContain("Al");
    expect(names(getScorersBy(data, "goals"))).not.toContain("Outsider");
  });

  it("gives the home page anyone with a goal or an assist, best scorers first, capped at the limit", () => {
    expect(names(getTopScorers(data, 10))).toBe("Bo,Al,Cy,Fay,Di");
    expect(getTopScorers(data, 2)).toHaveLength(2);
  });
});
