import { describe, expect, it } from "vitest";
import {
  dayKeyIn,
  formatChipLabel,
  formatDayKeyLong,
  formatDayLabel,
  formatKickoff,
  formatShortDate,
  formatZoneAbbr,
  matchDayKey,
  todayKeyIn,
} from "@/lib/format";
import { sameWallClock } from "@/lib/timezone";

const CHICAGO = "America/Chicago";
const AMSTERDAM = "Europe/Amsterdam";

/** 7:30 pm Central on 3 October 2026, which is 2:30 am on the 4th in Amsterdam. */
const EVENING = "2026-10-04T00:30:00.000Z";

describe("kickoffs read in the reader's zone", () => {
  it("renders the same instant as each reader's own clock", () => {
    expect(formatKickoff(EVENING, CHICAGO, false)).toBe("7:30 PM");
    expect(formatKickoff(EVENING, AMSTERDAM, false)).toBe("2:30 AM");
  });

  it("says TBA rather than inventing a time", () => {
    expect(formatKickoff(EVENING, AMSTERDAM, true)).toBe("TBA");
  });

  it("falls back to the conference zone for a zone it cannot construct", () => {
    expect(formatKickoff(EVENING, "Not/AZone", false)).toBe("7:30 PM");
  });

  it("reads the abbreviation at the match instant, not at now", () => {
    // Daylight time in September, standard time in December.
    expect(formatZoneAbbr("2026-09-15T23:00:00.000Z", CHICAGO)).toBe("CDT");
    expect(formatZoneAbbr("2026-12-15T23:00:00.000Z", CHICAGO)).toBe("CST");
  });

  it("names European zones too, which en-US alone will not", () => {
    expect(formatZoneAbbr("2026-09-15T23:00:00.000Z", AMSTERDAM)).toBe("CEST");
    expect(formatZoneAbbr("2026-12-15T23:00:00.000Z", AMSTERDAM)).toBe("CET");
    expect(formatZoneAbbr("2026-09-15T23:00:00.000Z", "Europe/London")).toBe("BST");
  });

  it("keeps a plain offset where no abbreviation exists", () => {
    expect(formatZoneAbbr("2026-09-15T23:00:00.000Z", "Asia/Kolkata")).toBe("GMT+5:30");
  });

  it("rolls the short date over with the reader", () => {
    expect(formatShortDate(EVENING, CHICAGO)).toBe("Oct 3");
    expect(formatShortDate(EVENING, AMSTERDAM)).toBe("Oct 4");
  });
});

describe("day keys", () => {
  it("puts one instant on different days for different readers", () => {
    expect(dayKeyIn(EVENING, CHICAGO)).toBe("2026-10-03");
    expect(dayKeyIn(EVENING, AMSTERDAM)).toBe("2026-10-04");
    expect(dayKeyIn(EVENING, "Pacific/Honolulu")).toBe("2026-10-03");
  });

  it("offsets today within the reader's own zone", () => {
    const now = new Date(EVENING);
    expect(todayKeyIn(CHICAGO, 0, now)).toBe("2026-10-03");
    expect(todayKeyIn(CHICAGO, 1, now)).toBe("2026-10-04");
    expect(todayKeyIn(CHICAGO, -1, now)).toBe("2026-10-02");
  });

  it("keeps a match with no kickoff on the venue's day for everyone", () => {
    // Noon Central on 31 October: the anchor the scraper stores for a TBA game.
    const tbd = { date: "2026-10-31T17:00:00.000Z", timeTbd: true, timezone: CHICAGO };
    for (const tz of [CHICAGO, AMSTERDAM, "Pacific/Auckland", "Pacific/Midway"]) {
      expect(matchDayKey(tbd, tz)).toBe("2026-10-31");
    }
  });

  it("follows the reader once a kickoff is published", () => {
    const match = { date: EVENING, timeTbd: false, timezone: CHICAGO };
    expect(matchDayKey(match, CHICAGO)).toBe("2026-10-03");
    expect(matchDayKey(match, AMSTERDAM)).toBe("2026-10-04");
  });
});

describe("day-key labels", () => {
  // A day key is already a calendar date. Rendering it through a named zone is
  // how a reader at UTC+14 gets handed the wrong weekday.
  it("names the day the key says, from either end of the date line", () => {
    const naive = (at: Date) =>
      new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(at);

    for (const tz of ["Pacific/Kiritimati", "Pacific/Midway", CHICAGO]) {
      process.env.TZ = tz;
      expect(formatDayKeyLong("2026-10-03")).toBe("Saturday, October 3");
      expect(formatChipLabel("2026-10-03", "2026-10-01").bottom).toBe("Oct 3");
    }

    // Proof the loop above has teeth: read through the ambient zone instead of
    // UTC and the far side of the date line hands back the wrong day.
    process.env.TZ = "Pacific/Kiritimati";
    expect(naive(new Date("2026-10-03T12:00:00Z"))).toBe("Sunday, October 4");
    process.env.TZ = "UTC";
  });

  it("prefers a relative label near today", () => {
    expect(formatDayLabel("2026-10-03", "2026-10-03")).toBe("Today");
    expect(formatDayLabel("2026-10-02", "2026-10-03")).toBe("Yesterday");
    expect(formatDayLabel("2026-10-04", "2026-10-03")).toBe("Tomorrow");
    expect(formatDayLabel("2026-10-06", "2026-10-03")).toBe("Tuesday, October 6");
  });

  it("crosses a month boundary relatively", () => {
    expect(formatDayLabel("2026-11-01", "2026-10-31")).toBe("Tomorrow");
    expect(formatDayLabel("2026-10-31", "2026-11-01")).toBe("Yesterday");
  });
});

describe("sameWallClock", () => {
  it("is true for zones that only differ in name", () => {
    expect(sameWallClock("America/Detroit", "America/New_York", Date.parse(EVENING))).toBe(true);
    expect(sameWallClock(CHICAGO, "America/Winnipeg", Date.parse(EVENING))).toBe(true);
  });

  it("is false for zones a reader would notice", () => {
    expect(sameWallClock(CHICAGO, "America/New_York", Date.parse(EVENING))).toBe(false);
    expect(sameWallClock(CHICAGO, AMSTERDAM, Date.parse(EVENING))).toBe(false);
  });

  it("answers for the match instant, because the answer moves", () => {
    const july = Date.parse("2026-07-15T20:00:00.000Z");
    const january = Date.parse("2026-01-15T20:00:00.000Z");
    // Arizona does not change its clocks; California does.
    expect(sameWallClock("America/Phoenix", "America/Los_Angeles", july)).toBe(true);
    expect(sameWallClock("America/Phoenix", "America/Los_Angeles", january)).toBe(false);
  });
});
