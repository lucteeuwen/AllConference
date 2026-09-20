import { describe, expect, it } from "vitest";
import { applyFilters, emptyFilters } from "@/lib/filters";
import { matchDayKey } from "@/lib/format";
import { groupMatchesByDate, slimForList } from "@/lib/selectors";
import { TBC_TEAM } from "@/lib/teams";
import type { Match } from "@/lib/types";

const CHICAGO = "America/Chicago";
const AMSTERDAM = "Europe/Amsterdam";

function match(id: string, date: string, timeTbd = false): Match {
  const side = { teamSlug: null, team: TBC_TEAM, placeholder: "TBC", score: null, pens: null };
  return {
    id,
    date,
    finishedAt: null,
    status: "scheduled",
    home: side,
    away: side,
    venue: "",
    timezone: CHICAGO,
    timeTbd,
    isConference: true,
    stage: "regular",
    bracketSlot: null,
    events: [],
  };
}

/** 7:30 pm Central on 3 October; 2:30 am on the 4th in Amsterdam. */
const evening = match("evening", "2026-10-04T00:30:00.000Z");
/** 1:00 pm Central the same day, which is still the 3rd everywhere west of Asia. */
const afternoon = match("afternoon", "2026-10-03T18:00:00.000Z");

const dayOf = (tz: string) => (entry: Match) => matchDayKey(entry, tz);

describe("grouping follows the reader", () => {
  it("keeps both games on one day in the conference's own zone", () => {
    const groups = groupMatchesByDate([afternoon, evening], dayOf(CHICAGO));
    expect(groups.map((group) => group.key)).toEqual(["2026-10-03"]);
    expect(groups[0].matches).toHaveLength(2);
  });

  it("splits them across two days for a reader in Europe", () => {
    const groups = groupMatchesByDate([afternoon, evening], dayOf(AMSTERDAM));
    expect(groups.map((group) => group.key)).toEqual(["2026-10-03", "2026-10-04"]);
    expect(groups[1].matches.map((entry) => entry.id)).toEqual(["evening"]);
  });

  it("holds a match with no kickoff on the venue's day everywhere", () => {
    const tbd = match("tbd", "2026-10-31T17:00:00.000Z", true);
    for (const tz of [CHICAGO, AMSTERDAM, "Pacific/Auckland"]) {
      expect(groupMatchesByDate([tbd], dayOf(tz))[0].key).toBe("2026-10-31");
    }
  });
});

describe("the ?day= filter is read in the reader's zone", () => {
  it("selects different matches for different readers", () => {
    const filters = { ...emptyFilters, day: "2026-10-03" };
    const list = [afternoon, evening];
    expect(applyFilters(list, filters, dayOf(CHICAGO)).map((entry) => entry.id)).toEqual([
      "afternoon",
      "evening",
    ]);
    // The evening game has already rolled into the 4th in Amsterdam.
    expect(applyFilters(list, filters, dayOf(AMSTERDAM)).map((entry) => entry.id)).toEqual([
      "afternoon",
    ]);
  });
});

describe("slimForList", () => {
  it("drops only what a list row never reads", () => {
    const full: Match = {
      ...evening,
      video: {
        url: "https://youtu.be/abc",
        provider: "youtube",
        label: "Watch",
        exact: true,
        platform: "YouTube",
      },
      boxscoreUrl: "https://example.test/box",
      recapUrl: "https://example.test/recap",
    };
    const slim = slimForList(full);
    expect(slim.video).toBeUndefined();
    expect(slim.boxscoreUrl).toBeUndefined();
    expect(slim.recapUrl).toBeUndefined();
    expect(slim.id).toBe(full.id);
    expect(slim.date).toBe(full.date);
    expect(slim.timezone).toBe(full.timezone);
    expect(slim.timeTbd).toBe(full.timeTbd);
  });
});
