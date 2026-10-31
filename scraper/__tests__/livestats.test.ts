import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TeamResolver, type MatchRecord, type TeamRow } from "../merge";
import {
  applyLiveStats,
  feedSwapped,
  folderFromStatsUrl,
  folderFromSummaryPage,
  liveEvents,
  liveStatsUrl,
  minuteOfClock,
  parseLiveStats,
  type LiveStats,
  type LiveStatsFeed,
} from "../sidearm/livestats";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const wheatonFeed = JSON.parse(fixture("livestats-wheaton.json")) as LiveStatsFeed;
// Real play payloads (goal with and without an assist, cards, a substitution,
// shots, set pieces, throw-ins) laid out as one game, newest play first.
const playsFeed = JSON.parse(fixture("livestats-plays.json")) as LiveStatsFeed;

const team = (slug: string, name: string, is_conference = true): TeamRow => ({
  slug,
  name,
  full_name: `${name} College`,
  abbr: name.slice(0, 3).toUpperCase(),
  location: "",
  venue: "",
  timezone: "America/Chicago",
  is_conference,
  sidearm_base_url: null,
  sidearm_sport_id: null,
  aliases: [],
  logo_url: null,
  logo_source_url: null,
  national_rank: null,
});

const teams = [team("wheaton", "Wheaton"), team("carthage", "Carthage")];

const record = (extra: Partial<MatchRecord> = {}) =>
  ({
    id: "2026-10-10-wheaton-carthage",
    date: "2026-10-11T00:00:00.000Z",
    status: "scheduled",
    home_slug: "wheaton",
    away_slug: "carthage",
    home_score: null,
    away_score: null,
    ...extra,
  }) as MatchRecord;

const live = (extra: Partial<LiveStats> = {}): LiveStats => ({
  day: "2026-10-10",
  homeName: "Wheaton",
  awayName: "Carthage",
  homeScore: 1,
  awayScore: 0,
  started: true,
  complete: false,
  periodMinutes: 45,
  plays: [],
  ...extra,
});

describe("parseLiveStats", () => {
  it("reads the score, day and state of a real feed", () => {
    expect(parseLiveStats(wheatonFeed)).toMatchObject({
      day: "2026-10-10",
      homeName: "Wheaton",
      awayName: "Carthage",
      homeScore: 1,
      awayScore: 0,
      started: true,
      complete: true,
      periodMinutes: 45,
    });
  });

  it("reads the plays the feed lists", () => {
    const stats = parseLiveStats(wheatonFeed);
    expect(stats?.plays).toHaveLength(5);
    expect(stats?.plays[0]).toMatchObject({ id: "231+B2227031", sequence: 231, type: "GAME", side: null, clockSeconds: 5400 });
  });

  it("reads a scorer, an assist and the side from a goal", () => {
    const goal = parseLiveStats(playsFeed)?.plays.find((play) => play.id === "30+A0000030");
    expect(goal).toMatchObject({
      side: "home",
      player: { name: "Matthew Perchik", number: 19 },
      involved: [{ name: "Ben Lyons", number: 7 }],
    });
  });

  it("gives up on a feed with no game", () => {
    expect(parseLiveStats({ Game: null })).toBeNull();
  });
});

describe("stats folders", () => {
  it("reads the folder from a sidearmstats.com link", () => {
    expect(folderFromStatsUrl("http://www.sidearmstats.com/carrollu/msoc/")).toBe("carrollu");
    expect(folderFromStatsUrl("https://athletics.wheaton.edu/sidearmstats/msoc/summary")).toBeNull();
    expect(folderFromStatsUrl("http://stats.statbroadcast.com/broadcast/?id=668453")).toBeNull();
    expect(folderFromStatsUrl(null)).toBeNull();
  });

  it("reads the folder from a school's summary page", () => {
    expect(folderFromSummaryPage(`<script>window.livestats_foldername = "nparku"</script>`)).toBe("nparku");
    expect(folderFromSummaryPage("<html></html>")).toBeNull();
  });
});

describe("applyLiveStats", () => {
  it("lays a live score over a match the scoreboard still has as scheduled", () => {
    const out = applyLiveStats(record(), live(), new TeamResolver(teams));
    expect(out).toMatchObject({ status: "live", home_score: 1, away_score: 0 });
  });

  it("maps the score when the feed has the sides the other way round", () => {
    const out = applyLiveStats(record(), live({ homeName: "Carthage", awayName: "Wheaton", homeScore: 2, awayScore: 1 }), new TeamResolver(teams));
    expect(out).toMatchObject({ home_score: 1, away_score: 2 });
  });

  it("marks the match final once the stat crew closes it", () => {
    expect(applyLiveStats(record(), live({ complete: true }), new TeamResolver(teams))?.status).toBe("final");
  });

  it("ignores the host's previous game", () => {
    expect(applyLiveStats(record(), live({ day: "2026-10-03" }), new TeamResolver(teams))).toBeNull();
    expect(applyLiveStats(record(), live({ awayName: "Loras" }), new TeamResolver(teams))).toBeNull();
  });

  it("allows the host's day to be one off the conference's", () => {
    expect(applyLiveStats(record(), live({ day: "2026-10-11" }), new TeamResolver(teams))).not.toBeNull();
  });

  it("leaves the match alone before kickoff", () => {
    const before = record();
    expect(applyLiveStats(before, live({ started: false, homeScore: 0 }), new TeamResolver(teams))).toBe(before);
  });

  it("never turns a posted result back into a live one", () => {
    const final = record({ status: "final", home_score: 2, away_score: 0 });
    expect(applyLiveStats(final, live(), new TeamResolver(teams))).toBe(final);
  });
});

describe("liveStatsUrl", () => {
  it("reads each sport's own feed", () => {
    expect(liveStatsUrl("wheaton", "men")).toBe("https://sidearmstats.com/wheaton/msoc/game.json?detail=game");
    expect(liveStatsUrl("wheaton", "women")).toBe("https://sidearmstats.com/wheaton/wsoc/game.json?detail=game");
  });
});

describe("minuteOfClock", () => {
  it("counts the minute being played, as a box score does", () => {
    expect(minuteOfClock(0)).toBe(1);
    expect(minuteOfClock(505)).toBe(9);
    expect(minuteOfClock(2700)).toBe(45);
    expect(minuteOfClock(5388)).toBe(90);
    expect(minuteOfClock(5400)).toBe(90);
  });
});

describe("feedSwapped", () => {
  const resolver = new TeamResolver(teams);

  it("says whether the feed lists the sides the other way round", () => {
    expect(feedSwapped(record(), live(), resolver)).toBe(false);
    expect(feedSwapped(record(), live({ homeName: "Carthage", awayName: "Wheaton" }), resolver)).toBe(true);
  });

  it("is null for another game", () => {
    expect(feedSwapped(record(), live({ day: "2026-10-20" }), resolver)).toBeNull();
    expect(feedSwapped(record(), live({ awayName: "Augustana" }), resolver)).toBeNull();
  });
});

describe("liveEvents", () => {
  const stats = parseLiveStats(playsFeed) as LiveStats;
  const events = (swapped = false) => liveEvents(stats, swapped).sort((a, b) => a.sort - b.sort);
  const byType = (type: string, swapped = false) => events(swapped).filter((event) => event.type === type);

  it("keeps the key plays and drops throw-ins, goal kicks and the kickoff after a goal", () => {
    expect(events().map((event) => event.type)).toEqual([
      "period", // kickoff
      "shot",
      "foul",
      "corner",
      "freekick",
      "goal",
      "yellow",
      "period", // half time
      "period", // second half
      "sub",
      "goal",
      "red",
      "period", // full time
    ]);
  });

  it("labels the markers", () => {
    expect(byType("period").map((event) => event.detail)).toEqual(["Kickoff", "Half time", "Second half", "Full time"]);
  });

  it("reads a goal with its assist and one without", () => {
    const [first, second] = byType("goal");
    expect(first).toMatchObject({ minute: 25, side: "home", player: { name: "Matthew Perchik" }, assists: [{ name: "Ben Lyons" }] });
    expect(second).toMatchObject({ minute: 73, side: "away", player: { name: "Iskander Sharipov" }, assists: [] });
  });

  it("takes the player coming on for a substitution, and who went off", () => {
    expect(byType("sub")[0]).toMatchObject({
      minute: 56,
      side: "away",
      player: { name: "Nathan Patzer", number: 3 },
      detail: "for Matthew Neumann",
    });
  });

  it("reads what became of a shot", () => {
    expect(byType("shot")[0]).toMatchObject({ minute: 7, detail: "missed high", player: { name: "Silas Wise" } });
  });

  it("puts a play on the match's home side when the feed lists the teams the other way round", () => {
    expect(byType("goal")[0].side).toBe("home");
    expect(byType("goal", true)[0].side).toBe("away");
    // Half time and full time belong to neither side.
    expect(byType("period", true).filter((event) => event.detail?.endsWith("time")).map((event) => event.side)).toEqual([
      null,
      null,
    ]);
  });

  it("recognises a penalty and an own goal", () => {
    const base = parseLiveStats(playsFeed) as LiveStats;
    const goal = base.plays.find((play) => play.type === "GOAL" && play.id.startsWith("30+")) as LiveStats["plays"][number];
    const make = (patch: Partial<typeof goal>) => liveEvents({ ...base, plays: [{ ...goal, ...patch }] }, false)[0].type;
    expect(make({ qualifiers: ["penalty"] })).toBe("penalty");
    expect(make({ narrative: "Own goal by WHE Perchik,Matthew" })).toBe("own-goal");
  });

  it("uses the feed's play id and running number", () => {
    const goal = byType("goal")[0];
    expect(goal.sourceId).toBe("30+A0000030");
    expect(goal.sort).toBe(30);
  });
});
