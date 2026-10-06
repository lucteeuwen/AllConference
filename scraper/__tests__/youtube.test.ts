import { describe, expect, it } from "vitest";
import { pickVideo, youtubeChannelOf, youtubeVideoId, type Video } from "../youtube";

const team = (slug: string, name: string, fullName = name) => ({ slug, name, fullName });
const teams = [
  team("wheaton", "Wheaton", "Wheaton College"),
  team("millikin", "Millikin", "Millikin University"),
  team("calvin", "Calvin", "Calvin University"),
  team("north-park", "North Park", "North Park University"),
  team("trine", "Trine", "Trine University"),
];

const game = (home: string, away: string, date: string, extra = {}) => ({
  home_slug: home,
  away_slug: away,
  date,
  time_tbd: false,
  ...extra,
});

const video = (id: string, title: string, start: string, live = true): Video => ({ id, title, start, live });

describe("youtubeChannelOf", () => {
  it("reads every way a school links its channel", () => {
    expect(youtubeChannelOf("https://www.youtube.com/@WheatonThunder")).toEqual({ handle: "@WheatonThunder" });
    expect(youtubeChannelOf("https://www.youtube.com/@illinoistechscarlethawks9213/streams")).toEqual({
      handle: "@illinoistechscarlethawks9213",
    });
    expect(youtubeChannelOf("https://www.youtube.com/channel/UCc7gBoPNxd3EmNnzGNtKOYw")).toEqual({
      id: "UCc7gBoPNxd3EmNnzGNtKOYw",
    });
    expect(youtubeChannelOf("https://www.youtube.com/khornets")).toEqual({ handle: "@khornets", username: "khornets" });
    expect(youtubeChannelOf("https://www.youtube.com/user/calvinknights")).toEqual({ username: "calvinknights" });
  });

  it("is not fooled by a video link", () => {
    expect(youtubeChannelOf("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youtubeChannelOf("https://www.youtube.com/live/dQw4w9WgXcQ")).toBeNull();
    expect(youtubeChannelOf("https://cciwnetwork.com/carthage/")).toBeNull();
  });
});

describe("youtubeVideoId", () => {
  it("reads the id from each kind of video link", () => {
    expect(youtubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeVideoId("https://www.youtube.com/live/dQw4w9WgXcQ?si=x")).toBe("dQw4w9WgXcQ");
    expect(youtubeVideoId("https://www.youtube.com/@WheatonThunder")).toBeNull();
  });
});

describe("pickVideo", () => {
  // Wheaton's channel carries every sport, and titles leave the sport out.
  const channel = [
    video("aaaaaaaaaaa", "Wheaton vs Millikin | FULL BROADCAST (9/19/2026)", "2026-09-19T16:55:00Z"),
    video("bbbbbbbbbbb", "Wheaton vs Millikin | FULL BROADCAST (9/30/2026)", "2026-09-30T21:50:00Z"),
    video("ccccccccccc", "Wheaton vs Millikin | FULL BROADCAST (9/30/2026)", "2026-10-01T00:20:00Z"),
    video("ddddddddddd", "Wheaton vs Calvin | FULL BROADCAST (9/15/2026)", "2026-09-15T22:00:00Z"),
    video("eeeeeeeeeee", "Calvin vs Wheaton | Postgame Interview", "2026-10-04T21:00:00Z"),
  ];

  it("takes the stream that started at kickoff, not the other sport's earlier that day", () => {
    const pick = pickVideo(game("wheaton", "millikin", "2026-10-01T00:30:00Z"), channel, teams, "wheaton");
    expect(pick.url).toBe("https://www.youtube.com/watch?v=ccccccccccc");
  });

  it("skips the post-match show streamed right after the game", () => {
    const show = [video("hhhhhhhhhhh", "The Postmatch with Steve McCrath | Wheaton vs Trine (9/15/2026)", "2026-09-16T01:50:00Z")];
    expect(pickVideo(game("wheaton", "trine", "2026-09-16T00:00:00Z"), show, teams, "wheaton").url).toBeNull();
  });

  it("finds nothing when the channel has no stream of the game", () => {
    expect(pickVideo(game("wheaton", "calvin", "2026-10-04T21:00:00Z"), channel, teams, "wheaton").url).toBeNull();
  });

  it("does not guess the stream for a game without a kickoff time", () => {
    const pick = pickVideo(game("wheaton", "millikin", "2026-10-01T05:00:00Z", { time_tbd: true }), channel, teams);
    expect(pick.url).toBeNull();
  });

  it("takes an upload after the game only when it is the only one that fits", () => {
    const one = [video("fffffffffff", "Men's Soccer: Calvin vs North Park", "2026-09-17T02:30:00Z", false)];
    expect(pickVideo(game("calvin", "north-park", "2026-09-16T23:00:00Z"), one, teams, "calvin").url).toBe(
      "https://www.youtube.com/watch?v=fffffffffff",
    );
    const two = [...one, video("ggggggggggg", "Calvin vs North Park", "2026-09-17T01:00:00Z", false)];
    expect(pickVideo(game("calvin", "north-park", "2026-09-16T23:00:00Z"), two, teams, "calvin").url).toBeNull();
  });
});
