import { describe, expect, it } from "vitest";
import { isActive, livePatch, type LiveRow } from "../live";
import type { MatchRecord } from "../merge";
import { parseScoreboard, type SidearmGame } from "../sidearm/schedule";

const MIN = 60_000;
const date = "2026-09-20T19:00:00.000Z";
const t0 = Date.parse(date);

const row = (extra: Partial<LiveRow> = {}): LiveRow => ({
  id: "2026-09-20-a-b",
  date,
  status: "scheduled",
  time_tbd: false,
  started_at: null,
  finished_at: null,
  home_slug: "a",
  away_slug: "b",
  home_score: null,
  away_score: null,
  home_pens: null,
  away_pens: null,
  boxscore_url: null,
  video_url: null,
  events_scraped: false,
  ...extra,
});

const record = (extra: Partial<MatchRecord> = {}) =>
  ({
    id: "2026-09-20-a-b",
    status: "scheduled",
    home_score: null,
    away_score: null,
    home_pens: null,
    away_pens: null,
    boxscore_url: null,
    video_url: null,
    ...extra,
  }) as MatchRecord;

describe("isActive", () => {
  it("covers 15 minutes before kickoff to 150 minutes after", () => {
    expect(isActive(row(), t0 - 16 * MIN)).toBe(false);
    expect(isActive(row(), t0 - 15 * MIN)).toBe(true);
    expect(isActive(row({ status: "live" }), t0 + 150 * MIN)).toBe(true);
    expect(isActive(row({ status: "live" }), t0 + 151 * MIN)).toBe(false);
  });

  it("skips matches with no time, or called off", () => {
    expect(isActive(row({ time_tbd: true }), t0)).toBe(false);
    expect(isActive(row({ status: "postponed" }), t0)).toBe(false);
  });

  it("keeps a finished match only until its box score is read", () => {
    expect(isActive(row({ status: "final", boxscore_url: "x" }), t0 + 120 * MIN)).toBe(true);
    expect(isActive(row({ status: "final", boxscore_url: "x", events_scraped: true }), t0 + 120 * MIN)).toBe(false);
    expect(isActive(row({ status: "final" }), t0 + 120 * MIN)).toBe(false);
  });
});

describe("livePatch", () => {
  it("returns null when nothing changed", () => {
    expect(livePatch(row(), record(), t0)).toBeNull();
  });

  it("writes only what changed", () => {
    const patch = livePatch(row({ status: "live", home_score: 1, away_score: 0 }), record({ status: "live", home_score: 1, away_score: 1 }), t0 + 40 * MIN);
    expect(patch).toEqual({ away_score: 1 });
  });

  it("marks the start when first seen live near kickoff, not when seen late", () => {
    const live = record({ status: "live", home_score: 0, away_score: 0 });
    expect(livePatch(row(), live, t0 + 3 * MIN)).toMatchObject({
      status: "live",
      started_at: new Date(t0 + 3 * MIN).toISOString(),
    });
    expect(livePatch(row(), live, t0 + 40 * MIN)?.started_at).toBeUndefined();
  });

  it("stamps finished_at when seen going final", () => {
    const patch = livePatch(row({ status: "live" }), record({ status: "final", home_score: 2, away_score: 1 }), t0 + 105 * MIN);
    expect(patch).toMatchObject({ status: "final", finished_at: new Date(t0 + 105 * MIN).toISOString() });
  });

  it("never rolls a match back", () => {
    const patch = livePatch(row({ status: "final", home_score: 2, away_score: 1 }), record({ status: "live", home_score: null, away_score: null }), t0 + 120 * MIN);
    expect(patch).toBeNull();
  });

  it("picks up a box score or video link", () => {
    expect(livePatch(row(), record({ boxscore_url: "b", video_url: "v" }), t0)).toEqual({
      boxscore_url: "b",
      video_url: "v",
    });
  });
});

describe("in-progress status", () => {
  const game = (status: string, scores: [string | null, string | null]): SidearmGame => ({
    id: 1,
    date: "2026-09-20T14:00:00",
    date_utc: "2026-09-20T19:00:00Z",
    tbd: false,
    status,
    location_indicator: "H",
    location: "Home",
    is_conference: true,
    tournament: null,
    opponent: { id: 2, name: "Carroll University", image: null },
    media: null,
    story: null,
    result: { status: null, team_score: scores[0], opponent_score: scores[1], prescore: null, postscore: null, boxscore: null },
  });
  const parse = (g: SidearmGame) => parseScoreboard([g], "a", "https://a.example", "2026-07-01")[0]?.status;

  it("counts an in-progress game as live before a goal is scored", () => {
    expect(parse(game("I", [null, null]))).toBe("live");
  });

  it("leaves a scheduled game with no score scheduled", () => {
    expect(parse(game("A", [null, null]))).toBe("scheduled");
    expect(parse(game("A", ["1", "0"]))).toBe("live");
  });
});
