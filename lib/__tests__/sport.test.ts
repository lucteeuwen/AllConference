import { describe, expect, it } from "vitest";
import { matchHref, parseSport, saysOtherSport, sportOfId, switchSportHref } from "@/lib/sport";
import { playerHref } from "@/lib/players";

describe("sport ids and links", () => {
  it("reads the sport from an id's prefix", () => {
    expect(sportOfId("2026-10-04-wheaton-carroll")).toBe("men");
    expect(sportOfId("cciw-2026-qf1")).toBe("men");
    expect(sportOfId("w-2026-10-04-wheaton-carroll")).toBe("women");
    expect(sportOfId("w-cciw-2026-qf1")).toBe("women");
  });

  it("links a match or player under its own sport", () => {
    expect(matchHref("2026-10-04-wheaton-carroll")).toBe("/men/matches/2026-10-04-wheaton-carroll");
    expect(matchHref("w-2026-10-04-wheaton-carroll", "?tab=lineups")).toBe(
      "/women/matches/w-2026-10-04-wheaton-carroll?tab=lineups",
    );
    expect(playerHref({ id: "w-2026-wheaton-jane-doe" })).toBe("/women/players/w-2026-wheaton-jane-doe");
  });

  it("falls back to men's for anything that is not a sport", () => {
    expect(parseSport("women")).toBe("women");
    expect(parseSport("matches")).toBe("men");
    expect(parseSport(undefined)).toBe("men");
  });
});

describe("switchSportHref", () => {
  it("keeps the section, and a school's page", () => {
    expect(switchSportHref("/men", "women")).toBe("/women");
    expect(switchSportHref("/men/standings", "women")).toBe("/women/standings");
    expect(switchSportHref("/women/matches", "men")).toBe("/men/matches");
    expect(switchSportHref("/men/teams/wheaton", "women")).toBe("/women/teams/wheaton");
  });

  it("sends a match or player page to the list, since it has no twin", () => {
    expect(switchSportHref("/men/matches/2026-10-04-wheaton-carroll", "women")).toBe("/women/matches");
    expect(switchSportHref("/women/players/w-2026-wheaton-jane-doe", "men")).toBe("/men/standings#scoring-leaders");
  });
});

describe("saysOtherSport", () => {
  it("spots the other sport in a title or link", () => {
    expect(saysOtherSport("Carroll vs. Carthage - Women's Soccer", "men")).toBe(true);
    expect(saysOtherSport("https://www.flocollege.com/events/123-wheaton-womens-soccer", "men")).toBe(true);
    expect(saysOtherSport("Carthage Men's Basketball vs Wheaton College", "women")).toBe(true);
    expect(saysOtherSport("https://www.flocollege.com/events/123-wheaton-mens-soccer", "women")).toBe(true);
  });

  it("does not read women's as men's, or a title without the sport as either", () => {
    expect(saysOtherSport("Carroll vs. Carthage - Women's Soccer", "women")).toBe(false);
    expect(saysOtherSport("Elmhurst vs Wheaton", "women")).toBe(false);
    expect(saysOtherSport("Elmhurst vs Wheaton", "men")).toBe(false);
    expect(saysOtherSport("Menomonee Falls vs Wheaton", "women")).toBe(false);
  });
});
