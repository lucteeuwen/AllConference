import { describe, expect, it } from "vitest";
import { leagueFor, leagueGroups, leagueLabel, LEAGUES, type League } from "@/lib/leagues";

describe("league menu", () => {
  it("groups the leagues under Men's and Women's", () => {
    const groups = leagueGroups();
    expect(groups.map((group) => group.sport)).toEqual(["men", "women"]);
    expect(groups.map((group) => group.label)).toEqual(["Men's Soccer", "Women's Soccer"]);
    expect(groups.every((group) => group.leagues.length === 1)).toBe(true);
  });

  it("lists a new conference under its own sport only", () => {
    const extra: League = { id: "nacc", sport: "women", name: "NACC", fullName: "Northern Athletics Collegiate Conference" };
    const groups = leagueGroups([...LEAGUES, extra]);
    expect(groups[0].leagues.map((league) => league.id)).toEqual(["cciw"]);
    expect(groups[1].leagues.map((league) => league.id)).toEqual(["cciw", "nacc"]);
  });

  it("leaves out a sport that has no league", () => {
    const menOnly = LEAGUES.filter((league) => league.sport === "men");
    expect(leagueGroups(menOnly).map((group) => group.sport)).toEqual(["men"]);
  });

  it("finds the league of a sport and names it", () => {
    expect(leagueLabel(leagueFor("men"))).toBe("CCIW Men's Soccer");
    expect(leagueLabel(leagueFor("women"))).toBe("CCIW Women's Soccer");
  });
});
