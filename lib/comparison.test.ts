import { describe, expect, it } from "vitest";
import { compareTeams, ordinal, type ComparisonInput } from "@/lib/comparison";
import type { Match, Player, Team } from "@/lib/types";

const team = (slug: string, name: string, extra: Partial<Team> = {}) =>
  ({ slug, name, fullName: name, nickname: "", location: "", venue: "", isConference: true, ...extra }) as Team;

const A = team("a", "Alpha", { location: "Aville, IL", nickname: "Ants", venue: "Ant Field" });
const B = team("b", "Beta", { location: "Bville, WI", venue: "" });
const C = team("c", "Gamma", { isConference: false });

let n = 0;
function game(home: Team, away: Team, homeScore: number | null, awayScore: number | null, status: Match["status"] = "final"): Match {
  n += 1;
  return {
    id: `m${n}`,
    date: `2026-09-${String(n).padStart(2, "0")}T18:00:00Z`,
    status,
    home: { teamSlug: home.slug, team: home, score: homeScore },
    away: { teamSlug: away.slug, team: away, score: awayScore },
    isConference: home.isConference && away.isConference,
    stage: "regular",
    events: [],
  } as unknown as Match;
}

const player = (teamSlug: string, name: string, goals: number, assists: number): Player => ({
  id: `${teamSlug}-${name}`,
  teamSlug,
  number: null,
  name,
  position: null,
  year: "",
  hometown: "",
  height: "",
  stats: { gp: 5, gs: 5, goals, assists },
});

function input(matches: Match[], extra: Partial<ComparisonInput> = {}): ComparisonInput {
  return {
    home: A,
    away: B,
    matchId: "current",
    matches,
    players: [],
    ranks: {},
    conference: {},
    conferenceStarted: false,
    ...extra,
  };
}

const row = (comparison: ReturnType<typeof compareTeams>, group: string, label: string) =>
  comparison.groups.find((g) => g.title === group)?.rows.find((r) => r.label === label);

describe("compareTeams", () => {
  // Alpha: W 2-0 over Gamma, D 1-1 with Beta-away? keep it simple and explicit.
  const matches = [
    game(A, C, 2, 0), // Alpha home win, clean sheet
    game(C, A, 1, 3), // Alpha away win
    game(B, C, 0, 2), // Beta home loss
    game(C, B, 1, 1), // Beta away draw
    game(A, B, 4, 4, "scheduled"), // ignored: not played
  ];

  it("counts record, points, goals and clean sheets from every finished game", () => {
    const c = compareTeams(input(matches));
    expect(row(c, "Season so far", "Record (W-D-L)")).toMatchObject({ home: "2-0-0", away: "0-1-1" });
    expect(row(c, "Season so far", "Points")).toMatchObject({ home: "6", away: "1", homeValue: 6, awayValue: 1 });
    expect(row(c, "Scoring", "Goals scored")).toMatchObject({ home: "5", away: "1" });
    expect(row(c, "Scoring", "Goals conceded")).toMatchObject({ home: "1", away: "3", better: "lower" });
    expect(row(c, "Scoring", "Goal difference")).toMatchObject({ home: "+4", away: "-2" });
    expect(row(c, "Scoring", "Clean sheets")).toMatchObject({ home: "1", away: "0" });
  });

  it("gives per-game figures to two decimals and a dash before a team has played", () => {
    const c = compareTeams(input(matches));
    expect(row(c, "Scoring", "Goals per game")).toMatchObject({ home: "2.50", away: "0.50" });
    const fresh = compareTeams(input([game(A, C, 1, 0)]));
    expect(row(fresh, "Scoring", "Goals per game")).toMatchObject({ home: "1.00", away: "—" });
    expect(row(fresh, "Season so far", "Win rate")).toMatchObject({ home: "100%", away: "—" });
  });

  it("splits home and away records", () => {
    const c = compareTeams(input(matches));
    expect(row(c, "Home and away", "At home")).toMatchObject({ home: "1-0-0 (2-0)", away: "0-0-1 (0-2)" });
    expect(row(c, "Home and away", "Away from home")).toMatchObject({ home: "1-0-0 (3-1)", away: "0-1-0 (1-1)" });
  });

  it("reports the form of both teams, oldest first", () => {
    const c = compareTeams(input(matches));
    expect(c.form).toEqual({ home: ["W", "W"], away: ["L", "D"] });
  });

  it("adds a CCIW group only when a team is in the conference, and says when the standing is by form", () => {
    const off = compareTeams(input(matches, { home: C, away: team("d", "Delta", { isConference: false }) }));
    expect(off.groups.some((g) => g.title === "CCIW")).toBe(false);

    const early = compareTeams(
      input(matches, { ranks: { a: 4, b: 9 }, conference: { a: { w: 0, l: 0, d: 0, pts: 0, gf: 0, ga: 0 }, b: { w: 0, l: 0, d: 0, pts: 0, gf: 0, ga: 0 } } }),
    );
    expect(row(early, "CCIW", "Conference standing")).toMatchObject({ home: "4th (by form)", away: "9th (by form)", better: "lower" });

    const started = compareTeams(
      input(matches, { conferenceStarted: true, ranks: { a: 1, b: 2 }, conference: { a: { w: 3, l: 0, d: 1, pts: 10, gf: 6, ga: 1 }, b: { w: 1, l: 2, d: 1, pts: 4, gf: 3, ga: 5 } } }),
    );
    expect(row(started, "CCIW", "Conference standing")).toMatchObject({ home: "1st", away: "2nd" });
    expect(row(started, "CCIW", "Conference record")).toMatchObject({ home: "3-1-0", away: "1-1-2" });
  });

  it("shows a dash for a team without conference numbers (a non-conference opponent)", () => {
    const c = compareTeams(input(matches, { away: C, ranks: { a: 2 }, conference: { a: { w: 1, l: 0, d: 0, pts: 3, gf: 1, ga: 0 } } }));
    expect(row(c, "CCIW", "Conference standing")).toMatchObject({ home: "2nd (by form)", away: "—" });
    expect(row(c, "CCIW", "Conference points")).toMatchObject({ home: "3", away: "—" });
  });

  it("names each roster's top scorer and assist leader, and skips the group with no rosters", () => {
    expect(compareTeams(input(matches)).groups.some((g) => g.title === "Squad")).toBe(false);
    const c = compareTeams(
      input(matches, {
        players: [player("a", "Ann Ace", 5, 1), player("a", "Bo Back", 2, 4), player("b", "Cy Cross", 0, 0)],
      }),
    );
    expect(row(c, "Squad", "Top scorer")).toMatchObject({ home: "Ann Ace · 5\u00a0G", away: "—" });
    expect(row(c, "Squad", "Most assists")).toMatchObject({ home: "Bo Back · 4\u00a0A", away: "—" });
    expect(row(c, "Squad", "Players on the roster")).toMatchObject({ home: "2", away: "1" });
  });

  it("counts cards only when they are supplied", () => {
    expect(compareTeams(input(matches)).groups.some((g) => g.title === "Discipline")).toBe(false);
    const c = compareTeams(input(matches, { cards: { a: { yellow: 3, red: 0 }, b: { yellow: 1, red: 1 } } }));
    expect(row(c, "Discipline", "Yellow cards")).toMatchObject({ home: "3", away: "1", better: "lower" });
    expect(row(c, "Discipline", "Red cards")).toMatchObject({ home: "0", away: "1" });
  });

  it("lists club facts and leaves out a row nobody has", () => {
    const c = compareTeams(input(matches));
    expect(row(c, "The clubs", "Based in")).toMatchObject({ home: "Aville, IL", away: "Bville, WI" });
    expect(row(c, "The clubs", "Home ground")).toMatchObject({ home: "Ant Field", away: "—" });
    expect(row(c, "The clubs", "Nickname")).toMatchObject({ home: "Ants", away: "—" });
  });

  it("finds the other meetings of the two teams, not this match", () => {
    const meeting = game(B, A, 1, 2);
    const c = compareTeams(input([...matches, meeting], { matchId: "current" }));
    expect(c.headToHead.map((m) => m.id)).toContain(meeting.id);
    const self = compareTeams(input([...matches, meeting], { matchId: meeting.id }));
    expect(self.headToHead.map((m) => m.id)).not.toContain(meeting.id);
  });
});

describe("ordinal", () => {
  it("handles the teens and the usual endings", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th",
    ]);
  });
});
