import { describe, expect, it } from "vitest";
import {
  becomesActive,
  eventRows,
  freshEvents,
  isActive,
  keepAhead,
  livePatch,
  reconcileGoals,
  reconcileStats,
  resolvePlayerId,
  statDeltas,
  UNKNOWN_PLAYER,
  type LiveRow,
  type StoredEvent,
} from "../live";
import type { LiveEvent } from "../sidearm/livestats";
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

  it("stops once the match is final", () => {
    expect(isActive(row({ status: "final", boxscore_url: "x" }), t0 + 100 * MIN)).toBe(false);
  });
});

describe("becomesActive", () => {
  it("waits for a match that comes into its window before the run ends", () => {
    expect(becomesActive(row(), t0 - 30 * MIN, t0 - 10 * MIN)).toBe(true);
    expect(becomesActive(row(), t0 - 30 * MIN, t0 - 20 * MIN)).toBe(false);
  });

  it("does not wait for one already on, called off or without a time", () => {
    expect(becomesActive(row(), t0, t0 + 30 * MIN)).toBe(false);
    expect(becomesActive(row({ status: "postponed" }), t0 - 30 * MIN, t0)).toBe(false);
    expect(becomesActive(row({ time_tbd: true }), t0 - 30 * MIN, t0)).toBe(false);
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

describe("keepAhead", () => {
  const match = (extra: Partial<MatchRecord> = {}) => record({ status: "scheduled", ...extra });

  it("keeps a live score the scoreboard feed has not caught up with", () => {
    expect(keepAhead(match(), { status: "live", home_score: 1, away_score: 0 })).toMatchObject({
      status: "live",
      home_score: 1,
      away_score: 0,
    });
  });

  it("keeps a final result over a feed that still says live", () => {
    expect(keepAhead(match({ status: "live", home_score: 1, away_score: 0 }), { status: "final", home_score: 2, away_score: 0 }))
      .toMatchObject({ status: "final", home_score: 2 });
  });

  it("lets the feed through once it is level or ahead", () => {
    const final = match({ status: "final", home_score: 3, away_score: 1 });
    expect(keepAhead(final, { status: "final", home_score: 2, away_score: 1 })).toBe(final);
    expect(keepAhead(final, { status: "live" })).toBe(final);
    expect(keepAhead(final, undefined)).toBe(final);
  });

  it("does not hold back a postponement", () => {
    const postponed = match({ status: "postponed" });
    expect(keepAhead(postponed, { status: "live", home_score: 0, away_score: 0 })).toBe(postponed);
  });
});

describe("live plays", () => {
  const match = { id: "2026-09-20-a-b", home_slug: "a", away_slug: "b" };
  const roster = [
    { id: "w-a-matthew-perchik", number: 19, name: "Matthew Perchik" },
    { id: "w-a-ben-lyons", number: 7, name: "Ben Lyons" },
    { id: "w-b-iskander-sharipov", number: 10, name: "Iskander Sharipov" },
  ];

  const play = (extra: Partial<LiveEvent> = {}): LiveEvent => ({
    sourceId: "30+AAAA",
    sort: 30,
    minute: 25,
    type: "goal",
    side: "home",
    player: { name: "Matthew Perchik", number: 19 },
    assists: [{ name: "Ben Lyons", number: 7 }],
    detail: null,
    ...extra,
  });
  const resolve = (team: string, player: { name: string; number: number | null }) =>
    resolvePlayerId(roster.filter((entry) => entry.id.startsWith(`w-${team}-`)), `w-${team}-${player.name.toLowerCase().replace(/ /g, "-")}`, player);
  const rows = (...events: Partial<LiveEvent>[]) => eventRows(match, events.map(play), resolve);
  const stored = (extra: Partial<StoredEvent> = {}): StoredEvent => ({
    type: "goal",
    team_slug: "a",
    minute: 25,
    player_name: "Matthew Perchik",
    player_id: "w-a-matthew-perchik",
    assist_player_id: null,
    source_id: "30+AAAA",
    counted: true,
    ...extra,
  });

  describe("resolvePlayerId", () => {
    it("uses the id a name makes, else a jersey number whose surname agrees", () => {
      expect(resolvePlayerId(roster, "w-a-matthew-perchik", { name: "Matthew Perchik", number: 19 })).toBe("w-a-matthew-perchik");
      expect(resolvePlayerId(roster, "w-a-matt-perchik", { name: "Matt Perchik", number: 19 })).toBe("w-a-matthew-perchik");
    });

    it("will not guess from a number alone", () => {
      expect(resolvePlayerId(roster, "w-a-someone", { name: "Someone Else", number: 19 })).toBeNull();
      expect(resolvePlayerId(roster, "w-a-matt-perchik", { name: "Matt Perchik", number: null })).toBeNull();
      expect(resolvePlayerId(roster, "x", null)).toBeNull();
    });
  });

  describe("eventRows", () => {
    it("files a play under the team of its side and links the scorer and assister", () => {
      expect(rows({})[0]).toMatchObject({
        match_id: match.id,
        team_slug: "a",
        player_name: "Matthew Perchik",
        player_id: "w-a-matthew-perchik",
        assist_name: "Ben Lyons",
        assist_player_id: "w-a-ben-lyons",
        source_id: "30+AAAA",
        counted: false,
      });
    });

    it("leaves a marker with no team, and an own goal with no credited scorer", () => {
      expect(rows({ type: "period", side: null, player: null, assists: [], detail: "Half time" })[0]).toMatchObject({
        team_slug: null,
        player_name: UNKNOWN_PLAYER,
        detail: "Half time",
      });
      expect(rows({ type: "own-goal", assists: [] })[0].player_id).toBeNull();
    });

    it("writes a shared assist the way a box score does", () => {
      const [row] = rows({ assists: [{ name: "Ben Lyons", number: 7 }, { name: "Noah Cameron", number: 3 }] });
      expect(row.assist_name).toBe("Ben Lyons , Noah Cameron");
    });
  });

  describe("freshEvents", () => {
    it("drops plays already stored, by the feed's id", () => {
      expect(freshEvents([stored()], rows({}, { sourceId: "31+BBBB", sort: 31, type: "shot", assists: [] }))).toHaveLength(1);
      expect(freshEvents([stored()], rows({}))).toHaveLength(0);
    });

    it("does not store a goal twice when an edit changed its id", () => {
      expect(freshEvents([stored()], rows({ sourceId: "30+CCCC" }))).toHaveLength(0);
    });

    it("lets two shots in one minute both through", () => {
      const shot = { type: "shot" as const, assists: [] };
      expect(freshEvents([], rows({ ...shot, sourceId: "1+A" }, { ...shot, sourceId: "2+B" }))).toHaveLength(2);
    });
  });

  describe("reconcileGoals", () => {
    const withScore = (home: number | null, away: number | null) => ({ home, away });

    it("adds nothing when the plays account for the score", () => {
      expect(reconcileGoals(match, [stored()], [], withScore(1, 0), 30)).toEqual({ drop: [], add: [] });
    });

    it("holds a placeholder for a goal the feed scored but did not list", () => {
      const { add } = reconcileGoals(match, [stored()], [], withScore(1, 2), 63);
      expect(add).toHaveLength(2);
      expect(add[0]).toMatchObject({
        type: "goal",
        team_slug: "b",
        minute: 63,
        player_name: UNKNOWN_PLAYER,
        source_id: "gap-away-1",
        counted: false,
      });
      expect(add[1].source_id).toBe("gap-away-2");
    });

    it("drops a placeholder once the play that names the goal arrives", () => {
      const placeholder = stored({ player_name: UNKNOWN_PLAYER, player_id: null, source_id: "gap-home-1", counted: false });
      const named = rows({})[0];
      const { drop, add } = reconcileGoals(match, [placeholder], [named], withScore(1, 0), 30);
      expect(drop).toEqual(["gap-home-1"]);
      expect(add).toEqual([]);
    });

    it("counts an own goal for the side that benefited", () => {
      const own = rows({ type: "own-goal", side: "away", player: { name: "Iskander Sharipov", number: 10 }, assists: [] });
      expect(reconcileGoals(match, [], own, withScore(1, 0), 30).add).toEqual([]);
      expect(reconcileGoals(match, [], own, withScore(0, 1), 30).add).toHaveLength(1);
    });

    it("does nothing without a score", () => {
      expect(reconcileGoals(match, [], [], withScore(null, null), 30)).toEqual({ drop: [], add: [] });
    });
  });

  describe("statDeltas", () => {
    it("credits goals, penalties, assists and cards to known players", () => {
      const deltas = statDeltas([
        ...rows({}, { type: "penalty", assists: [], sourceId: "2+A" }, { type: "yellow", assists: [], sourceId: "3+A" }),
        ...rows({ type: "red", side: "away", player: { name: "Iskander Sharipov", number: 10 }, assists: [], sourceId: "4+A" }),
      ]);
      expect(deltas.get("w-a-matthew-perchik")).toEqual({ goals: 2, assists: 0, yellow: 1, red: 0, pk: 1 });
      expect(deltas.get("w-a-ben-lyons")).toEqual({ goals: 0, assists: 1, yellow: 0, red: 0, pk: 0 });
      expect(deltas.get("w-b-iskander-sharipov")).toMatchObject({ red: 1 });
    });

    it("ignores plays that are not goals or cards, own goals, and players we cannot place", () => {
      const deltas = statDeltas([
        ...rows({ type: "shot", assists: [], sourceId: "1+A" }, { type: "sub", assists: [], sourceId: "2+A" }, { type: "own-goal", sourceId: "3+A" }),
        ...rows({ player: { name: "Walk On", number: 99 }, assists: [], sourceId: "4+A" }),
      ]);
      expect(deltas.size).toBe(0);
    });
  });

  describe("reconcileStats", () => {
    const goal = (player: string | null) => ({ type: "goal" as const, player_id: player, assist_player_id: null });

    it("moves a credit to the player the box score names", () => {
      const deltas = reconcileStats([goal("p1")], [goal("p2")]);
      expect(deltas.get("p1")).toMatchObject({ goals: -1 });
      expect(deltas.get("p2")).toMatchObject({ goals: 1 });
    });

    it("changes nothing when live mode and the box score agree", () => {
      expect(reconcileStats([goal("p1")], [goal("p1")]).size).toBe(0);
    });

    it("leaves assists to the school's own totals", () => {
      const assisted = { type: "goal" as const, player_id: "p1", assist_player_id: "p2" };
      expect(reconcileStats([assisted], [{ ...assisted, assist_player_id: null }]).size).toBe(0);
    });
  });
});
