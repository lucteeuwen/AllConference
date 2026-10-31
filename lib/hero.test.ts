import { describe, expect, it } from "vitest";
import { pickHeroMatch, pickHeroMatches } from "@/lib/hero";
import { TBC_TEAM } from "@/lib/teams";
import type { Match, MatchStatus } from "@/lib/types";

const MIN = 60_000;
const kickoff = Date.parse("2026-10-24T19:00:00.000Z");

function match(id: string, atMin: number, status: MatchStatus = "scheduled", slugs: [string | null, string | null] = ["a", "b"]): Match {
  const side = (teamSlug: string | null) => ({ teamSlug, team: TBC_TEAM, score: null });
  return {
    id,
    date: new Date(kickoff + atMin * MIN).toISOString(),
    finishedAt: null,
    status,
    home: side(slugs[0]),
    away: side(slugs[1]),
    venue: "",
    timezone: "America/Chicago",
    timeTbd: false,
    isConference: true,
    stage: "regular",
    bracketSlot: null,
    events: [],
  };
}

describe("pickHeroMatches", () => {
  it("returns every match whose box is up, not just one", () => {
    const matches = [match("m1", 0), match("m2", 0), match("m3", 0), match("m4", 0)];
    expect(pickHeroMatches(matches, kickoff + 40 * MIN).map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4"]);
  });

  it("puts live before upcoming before finished, then soonest kickoff first", () => {
    const matches = [
      match("done", -200, "final"),
      match("soon", 120),
      match("late-live", 15, "live"),
      match("early-live", 0, "live"),
    ];
    const now = kickoff + 112 * MIN;
    // "done" ended 15+ minutes ago by the clock, so it has left the window.
    expect(pickHeroMatches(matches, kickoff + 30 * MIN).map((m) => m.id)).toEqual(["early-live", "late-live"]);
    expect(pickHeroMatches(matches, now).map((m) => m.id)).toContain("soon");
  });

  it("leaves out matches outside their window and sides still to be decided", () => {
    const matches = [match("far", 600), match("tbc", 0, "scheduled", [null, "b"]), match("on", 0)];
    expect(pickHeroMatches(matches, kickoff + 10 * MIN).map((m) => m.id)).toEqual(["on"]);
  });

  it("breaks a tie between simultaneous kickoffs by id, so the featured card is stable", () => {
    const matches = [match("m2", 0), match("m1", 0)];
    expect(pickHeroMatches(matches, kickoff + 5 * MIN).map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("still offers a single match to callers that want one", () => {
    expect(pickHeroMatch([match("m1", 0), match("m2", 0)], kickoff + 5 * MIN)?.id).toBe("m1");
    expect(pickHeroMatch([match("far", 600)], kickoff)).toBeNull();
  });
});
