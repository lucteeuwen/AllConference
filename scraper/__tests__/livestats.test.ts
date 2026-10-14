import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TeamResolver, type MatchRecord, type TeamRow } from "../merge";
import {
  applyLiveStats,
  folderFromStatsUrl,
  folderFromSummaryPage,
  liveStatsUrl,
  parseLiveStats,
  type LiveStats,
  type LiveStatsFeed,
} from "../sidearm/livestats";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const wheatonFeed = JSON.parse(fixture("livestats-wheaton.json")) as LiveStatsFeed;

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
  ...extra,
});

describe("parseLiveStats", () => {
  it("reads the score, day and state of a real feed", () => {
    expect(parseLiveStats(wheatonFeed)).toEqual({
      day: "2026-10-10",
      homeName: "Wheaton",
      awayName: "Carthage",
      homeScore: 1,
      awayScore: 0,
      started: true,
      complete: true,
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
