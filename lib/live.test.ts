import { describe, expect, it } from "vitest";
import { heroPhase, type HeroTiming } from "@/lib/hero";
import { effectiveStatus, inWatchWindow, matchClock, startFromEvent, type LiveTiming } from "@/lib/live";

const MIN = 60_000;
const kickoff = "2026-09-20T19:00:00.000Z";
const t0 = Date.parse(kickoff);
const timing = (extra: Partial<LiveTiming> = {}): LiveTiming => ({ kickoff, status: "scheduled", ...extra });

describe("effectiveStatus", () => {
  it("is scheduled until kickoff, then live", () => {
    expect(effectiveStatus(timing(), t0 - 1).status).toBe("scheduled");
    expect(effectiveStatus(timing(), t0).status).toBe("live");
  });

  it("calls a match full time, unconfirmed, once it should be over", () => {
    expect(effectiveStatus(timing(), t0 + 109 * MIN)).toEqual({ status: "live", unconfirmed: false });
    expect(effectiveStatus(timing(), t0 + 110 * MIN)).toEqual({ status: "full-time", unconfirmed: true });
    expect(effectiveStatus(timing({ status: "live" }), t0 + 300 * MIN)).toEqual({
      status: "full-time",
      unconfirmed: true,
    });
  });

  it("confirms full time only from a stored final", () => {
    expect(effectiveStatus(timing({ status: "final" }), t0 + 10 * MIN)).toEqual({
      status: "full-time",
      unconfirmed: false,
    });
  });

  it("leaves postponed and canceled alone", () => {
    expect(effectiveStatus(timing({ status: "postponed" }), t0 + 10 * MIN).status).toBe("postponed");
    expect(effectiveStatus(timing({ status: "canceled" }), t0 + 10 * MIN).status).toBe("canceled");
  });

  it("does not count from a day anchor", () => {
    expect(effectiveStatus(timing({ timeTbd: true }), t0 + 30 * MIN).status).toBe("scheduled");
  });

  it("counts from startedAt when known", () => {
    const started = new Date(t0 + 20 * MIN).toISOString();
    expect(effectiveStatus(timing({ status: "live", startedAt: started }), t0 + 125 * MIN).status).toBe("live");
    expect(effectiveStatus(timing({ status: "live", startedAt: started }), t0 + 130 * MIN).status).toBe("full-time");
  });
});

describe("inWatchWindow", () => {
  it("opens 15 minutes before kickoff and closes 150 minutes after", () => {
    expect(inWatchWindow(timing(), t0 - 16 * MIN)).toBe(false);
    expect(inWatchWindow(timing(), t0 - 15 * MIN)).toBe(true);
    expect(inWatchWindow(timing(), t0 + 150 * MIN)).toBe(true);
    expect(inWatchWindow(timing(), t0 + 151 * MIN)).toBe(false);
  });

  it("ignores finished, unscheduled-time and called-off matches", () => {
    expect(inWatchWindow(timing({ status: "final" }), t0 + 10 * MIN)).toBe(false);
    expect(inWatchWindow(timing({ timeTbd: true }), t0 + 10 * MIN)).toBe(false);
    expect(inWatchWindow(timing({ status: "postponed" }), t0 + 10 * MIN)).toBe(false);
  });
});

describe("matchClock", () => {
  it("counts the first half up from 1'", () => {
    expect(matchClock(timing(), t0).label).toBe("1'");
    expect(matchClock(timing(), t0 + 33 * MIN + 10_000).label).toBe("34'");
    expect(matchClock(timing(), t0 + 44 * MIN + 59_000).label).toBe("45'");
  });

  it("shows half time for ten minutes", () => {
    expect(matchClock(timing(), t0 + 45 * MIN)).toMatchObject({ label: "HT", halftime: true });
    expect(matchClock(timing(), t0 + 54 * MIN)).toMatchObject({ halftime: true });
  });

  it("resumes at 46' and caps at 90+'", () => {
    expect(matchClock(timing(), t0 + 55 * MIN).label).toBe("46'");
    expect(matchClock(timing(), t0 + 99 * MIN).label).toBe("90'");
    expect(matchClock(timing(), t0 + 100 * MIN).label).toBe("90+'");
  });

  it("counts from startedAt over kickoff", () => {
    const started = new Date(t0 + 5 * MIN).toISOString();
    expect(matchClock(timing({ startedAt: started }), t0 + 15 * MIN).label).toBe("11'");
  });
});

describe("startFromEvent", () => {
  it("puts the start back by the minutes played, halftime included", () => {
    const seen = t0 + 30 * MIN;
    expect(startFromEvent(30, seen, kickoff)).toBe(new Date(seen - 29.5 * MIN).toISOString());
    const late = t0 + 80 * MIN;
    expect(startFromEvent(70, late, kickoff)).toBe(new Date(late - 69.5 * MIN - 10 * MIN).toISOString());
  });

  it("round-trips with the clock", () => {
    const seen = t0 + 100 * MIN;
    const start = startFromEvent(75, seen, kickoff)!;
    expect(matchClock(timing({ startedAt: start }), seen).minute).toBe(75);
  });

  it("ignores minutes that say little", () => {
    expect(startFromEvent(45, t0 + 50 * MIN, kickoff)).toBeNull();
    expect(startFromEvent(46, t0 + 50 * MIN, kickoff)).toBeNull();
    expect(startFromEvent(93, t0 + 110 * MIN, kickoff)).toBeNull();
  });

  it("ignores a start far from the scheduled kickoff", () => {
    expect(startFromEvent(10, t0 + 90 * MIN, kickoff)).toBeNull();
  });
});

describe("heroPhase", () => {
  const hero = (extra: Partial<HeroTiming> = {}): HeroTiming => ({ kickoff, finishedAt: null, status: "scheduled", ...extra });

  it("walks from pre-match through live to full time and gone", () => {
    expect(heroPhase(hero(), t0 - 16 * MIN)).toBe("hidden");
    expect(heroPhase(hero(), t0 - 10 * MIN)).toBe("pre");
    expect(heroPhase(hero(), t0 - 30_000)).toBe("starting");
    expect(heroPhase(hero(), t0)).toBe("live");
    expect(heroPhase(hero(), t0 + 110 * MIN)).toBe("post");
    expect(heroPhase(hero(), t0 + 126 * MIN)).toBe("hidden");
  });
});
