import { describe, expect, it } from "vitest";
import { classifyVideo, titleNamesBoth, titleVerdict } from "@/lib/video";
import type { Team } from "@/lib/types";

const team = (slug: string, name: string, fullName = name) => ({ slug, name, fullName }) as Team;
const teams = [
  team("illinois", "Illinois", "Illinois College"),
  team("illinois-wesleyan", "Illinois Wesleyan", "Illinois Wesleyan University"),
  team("knox", "Knox", "Knox College"),
  team("monmouth", "Monmouth"),
  team("wheaton", "Wheaton", "Wheaton College"),
  team("north-central", "North Central", "North Central College"),
  team("central", "Central"),
  team("colorado", "Colorado", "Colorado College"),
  team("carroll", "Carroll", "Carroll University"),
  team("university-of-dubuque", "University of Dubuque"),
  team("elmhurst", "Elmhurst", "Elmhurst University"),
  team("uw-stevens-point", "UW-Stevens Point"),
  team("university-of-wisconsin-stevens-point", "University of Wisconsin-Stevens Point"),
  team("augustana", "Augustana", "Augustana College"),
  team("washu", "WashU"),
  team("washington-in-st-louis", "Washington in St. Louis", "Washington University in St. Louis"),
  team("semifinals", "Semifinals"),
  team("north-park", "North Park", "North Park University"),
  team("milwaukee-school-of-engineering", "Milwaukee School of Engineering"),
  team("concordia-chicago", "Concordia Chicago"),
  team("university-of-chicago", "University of Chicago"),
];

describe("classifyVideo", () => {
  it("treats a Hudl TV broadcast id as this game's own stream", () => {
    const video = classifyVideo("https://www.cciwnetwork.com/northcentralcardinals/?B=4128200");
    expect(video).toMatchObject({ exact: true, provider: "hudl", broadcastId: "4128200", platform: "CCIW Network" });
  });

  it("treats a team page or channel as the platform, not a game", () => {
    for (const url of [
      "https://cciwnetwork.com/carthage/",
      "https://www.youtube.com/@WheatonThunder",
      "https://boxcast.tv/channel/dmfutowrtlmndztdlxrk",
      "https://athletics.aurora.edu/gameday",
    ]) {
      const video = classifyVideo(url);
      expect(video?.exact, url).toBe(false);
      expect(video?.label, url).toMatch(/^Find the game on /);
    }
  });

  it("embeds a specific YouTube video", () => {
    const video = classifyVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(video).toMatchObject({ exact: true, embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" });
  });

  it("unwraps FloCollege sign-up links and drops the tracking", () => {
    const video = classifyVideo(
      "https://www.flocollege.com/signup?redirect=%2Flive%2F269046&utm_campaign=x&contract_id=y",
    );
    expect(video).toMatchObject({ exact: true, provider: "flo", url: "https://www.flocollege.com/live/269046" });
  });

  it("ignores anything that is not a web address", () => {
    expect(classifyVideo("javascript:alert(1)")).toBeUndefined();
    expect(classifyVideo(null)).toBeUndefined();
  });
});

describe("titleVerdict", () => {
  const verdict = (title: string, ...playing: string[]) => titleVerdict(title, playing, teams);

  it("accepts a title naming the teams that are playing", () => {
    expect(verdict("Illinois Wesleyan vs Knox- Men's Soccer", "illinois-wesleyan", "knox")).toBe("match");
    expect(verdict("Men's Soccer vs Illinois Wesleyan University", "north-central", "illinois-wesleyan")).toBe("match");
    expect(verdict("vs. Colorado College", "carroll", "colorado")).toBe("match");
    expect(verdict("Dubuque vs. Elmhurst", "university-of-dubuque", "elmhurst")).toBe("match");
  });

  it("rejects the link that pointed Illinois Wesleyan v Wheaton at Illinois Wesleyan v Monmouth", () => {
    expect(verdict("Illinois Wesleyan vs Monmouth- Men's Soccer", "illinois-wesleyan", "wheaton")).toBe("mismatch");
  });

  it("does not read Illinois Wesleyan as Illinois College", () => {
    expect(verdict("Illinois Wesleyan vs Knox- Men's Soccer", "illinois", "knox")).toBe("mismatch");
  });

  it("rejects a women's game", () => {
    expect(verdict("Wheaton vs Knox Women's Soccer", "wheaton", "knox")).toBe("mismatch");
    expect(verdict("Wheaton vs Knox Womens Soccer", "wheaton", "knox")).toBe("mismatch");
  });

  it("can't confirm a title that names nobody", () => {
    expect(verdict("Live Stream", "wheaton", "knox")).toBe("unknown");
    expect(verdict("Semifinals live", "wheaton", "knox")).toBe("unknown");
  });

  it("treats a school stored under two slugs as the same team", () => {
    expect(verdict("UW-Stevens Point vs. Augustana", "uw-stevens-point", "augustana")).toBe("match");
    expect(verdict("UW-Stevens Point vs. Augustana", "university-of-wisconsin-stevens-point", "augustana")).toBe("match");
    expect(verdict("WashU vs Elmhurst", "washington-in-st-louis", "elmhurst")).toBe("match");
  });
});

describe("titleNamesBoth", () => {
  const both = (title: string, ...playing: string[]) => titleNamesBoth(title, playing, teams);

  it("knows a school by the short form its opponents' titles use", () => {
    expect(both("North Park University vs MSOE", "north-park", "milwaukee-school-of-engineering")).toBe(true);
    expect(both("Men's Soccer vs CUC", "augustana", "concordia-chicago")).toBe(false);
    expect(titleNamesBoth("Men\u2019s Soccer vs CUC", ["augustana", "concordia-chicago"], teams, "augustana")).toBe(true);
  });

  it("reads past the words a school's name may or may not carry", () => {
    expect(
      both("Augustana College vs Concordia University Chicago Men's Varsity Soccer", "augustana", "concordia-chicago"),
    ).toBe(true);
    expect(both("Carroll University vs University of Chicago", "carroll", "university-of-chicago")).toBe(true);
    expect(both("Elmhurst University vs Washington University in St Louis", "elmhurst", "washington-in-st-louis")).toBe(true);
  });

  it("does not read Concordia Chicago as the University of Chicago", () => {
    expect(both("Augustana vs Concordia University Chicago", "augustana", "university-of-chicago")).toBe(false);
  });

  it("uses a team's stored aliases", () => {
    const withAlias = [...teams, { slug: "ncc", name: "Nowhere", fullName: "Nowhere", aliases: ["Cardinals Club"] }];
    expect(titleNamesBoth("Cardinals Club vs Knox", ["ncc", "knox"], withAlias)).toBe(true);
  });
});
