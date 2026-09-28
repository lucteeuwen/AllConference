import { describe, expect, it } from "vitest";
import { buildGameLog, playerLookup, rankOf, splitAssists, summarize, type EventRecord, type LineupRecord } from "@/lib/players";
import type { Match, Player } from "@/lib/types";

const player = (name: string, teamSlug = "a", stats: Partial<Player["stats"]> = {}): Player =>
  ({
    id: `2026-${teamSlug}-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
    name,
    teamSlug,
    position: "M",
    stats: { gp: 0, gs: 0, goals: 0, assists: 0, ...stats },
  }) as Player;

const match = (id: string, date: string, home: string, away: string, score: [number, number]): Match =>
  ({
    id,
    date,
    status: "final",
    home: { teamSlug: home, score: score[0] },
    away: { teamSlug: away, score: score[1] },
  }) as Match;

describe("playerLookup", () => {
  const players = [player("Alexander Smith"), player("José Núñez"), player("Sam Lee"), player("Sara Lee"), player("Sam Lee", "b")];
  const lookup = playerLookup(players);

  it("matches names the way the scraper builds ids, accents and case aside", () => {
    expect(lookup("a", "jose nunez")?.name).toBe("José Núñez");
    expect(lookup("b", "Sam Lee")?.teamSlug).toBe("b");
  });

  it("falls back to first initial and surname when that is unambiguous", () => {
    expect(lookup("a", "Alex Smith")?.name).toBe("Alexander Smith");
    expect(lookup("a", "S. Lee")).toBeNull();
  });

  it("reads names printed surname first", () => {
    expect(lookup("a", "Smith, Alexander")?.name).toBe("Alexander Smith");
  });

  it("never matches across teams, or blank names", () => {
    expect(lookup("c", "Alexander Smith")).toBeNull();
    expect(lookup(null, "Alexander Smith")).toBeNull();
    expect(lookup("a", "")).toBeNull();
  });
});

describe("buildGameLog", () => {
  const me = player("Alexander Smith");
  const lookup = playerLookup([me]);
  const matches = [
    match("m2", "2026-09-10T00:00:00Z", "b", "a", [1, 2]),
    match("m1", "2026-09-03T00:00:00Z", "a", "c", [0, 0]),
  ];
  const lineups: LineupRecord[] = [
    { match_id: "m1", team_slug: "a", starter: false, position: null, player_name: "Alex Smith", player_id: null },
    { match_id: "m2", team_slug: "a", starter: true, position: "M", player_name: "Alexander Smith", player_id: me.id },
    { match_id: "m2", team_slug: "b", starter: true, position: "M", player_name: "Alexander Smith", player_id: null },
  ];
  const event = (partial: Partial<EventRecord>): EventRecord => ({
    match_id: "m2",
    minute: 10,
    type: "goal",
    team_slug: "a",
    player_name: "Someone Else",
    player_id: null,
    assist_name: null,
    assist_player_id: null,
    ...partial,
  });
  const events = [
    event({ player_name: "Alexander Smith", minute: 12 }),
    event({ type: "penalty", player_name: "Alexander Smith", minute: 70 }),
    event({ assist_name: "Alex Smith" }),
    event({ type: "yellow", player_name: "Alexander Smith" }),
    event({ type: "own-goal", player_name: "Alexander Smith" }),
    event({ player_name: "Alexander Smith", team_slug: "b" }),
  ];
  const games = buildGameLog(me, matches, lineups, events, lookup);

  it("lists every game the player is in, oldest first", () => {
    expect(games.map((game) => game.match.id)).toEqual(["m1", "m2"]);
    expect(games[0]).toMatchObject({ started: false, goals: 0 });
  });

  it("counts only the player's own team's events", () => {
    expect(games[1]).toMatchObject({
      started: true,
      position: "M",
      goals: 2,
      penalties: 1,
      assists: 1,
      yellow: 1,
      goalMinutes: [12, 70],
    });
  });

  it("summarizes the team's record in the player's starts", () => {
    const summary = summarize({ ...me, stats: { ...me.stats, gp: 2, goals: 2 } }, null, games, [me], 2);
    expect(summary.startedRecord).toEqual({ w: 1, d: 0, l: 0 });
    expect(summary.multiGoalGames).toBe(1);
    expect(summary.firstGoal?.match.id).toBe("m2");
    expect(summary.teamGoalShare).toBe(1);
  });
});

describe("splitAssists", () => {
  it("splits a shared assist but leaves a surname-first name whole", () => {
    expect(splitAssists("Carson Belcher , Noah Cameron")).toEqual(["Carson Belcher", "Noah Cameron"]);
    expect(splitAssists("Belcher, Carson")).toEqual(["Belcher, Carson"]);
  });
});

describe("rankOf", () => {
  it("shares a rank between players level on the stat", () => {
    expect(rankOf(5, [7, 5, 5, 2])).toEqual({ rank: 2, tied: true });
    expect(rankOf(7, [7, 5, 5, 2])).toEqual({ rank: 1, tied: false });
  });
});
