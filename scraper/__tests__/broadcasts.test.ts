import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { broadcastUrl, hudlSiteOf, pickBroadcast, type Broadcast } from "../broadcasts";

// A real slice of the CCIW Network's men's soccer broadcast list.
const broadcasts = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "broadcasts-sample.json"), "utf8"),
) as Broadcast[];

const team = (slug: string, name: string, fullName = name) => ({ slug, name, fullName });
const teams = [
  team("elmhurst", "Elmhurst", "Elmhurst University"),
  team("lake-forest", "Lake Forest", "Lake Forest College"),
  team("knox", "Knox", "Knox College"),
  team("washington-in-st-louis", "WashU", "Washington University in St Louis"),
  team("wheaton", "Wheaton", "Wheaton College"),
  team("north-park", "North Park", "North Park University"),
  team("claremont-mudd-scripps", "Claremont-Mudd-Scripps", "Claremont-Mudd-Scripps Colleges"),
  team("pacific-lutheran", "Pacific Lutheran", "Pacific Lutheran University"),
  team("greenville", "Greenville", "Greenville University"),
  team("augustana", "Augustana", "Augustana College"),
  team("concordia-chicago", "Concordia Chicago"),
  team("milwaukee-school-of-engineering", "Milwaukee School of Engineering"),
  team("university-of-wisconsin-stevens-point", "University of Wisconsin-Stevens Point"),
];

const game = (home: string, away: string, date: string, extra = {}) => ({
  home_slug: home,
  away_slug: away,
  date,
  time_tbd: false,
  ...extra,
});

describe("broadcastUrl", () => {
  it("links to the game on the network, under the school's lower-cased site", () => {
    expect(broadcastUrl({ id: "4123942", site: "ACVikings" })).toBe("https://cciwnetwork.com/acvikings/?B=4123942");
  });
});

describe("hudlSiteOf", () => {
  it("reads the school's site on any Hudl network", () => {
    expect(hudlSiteOf("https://www.wiacnetwork.com/stevenspoint/")).toEqual({
      portal: "https://wiacnetwork.com",
      site: "stevenspoint",
    });
    expect(hudlSiteOf("https://rollriversnetwork.com/dubuque/?B=4179584")?.site).toBe("dubuque");
  });

  it("ignores other hosts and a portal's front page", () => {
    expect(hudlSiteOf("https://boxcast.tv/channel/dmfutowrtlmndztdlxrk")).toBeNull();
    expect(hudlSiteOf("https://cciwnetwork.com/?B=4112816")).toBeNull();
    expect(hudlSiteOf(null)).toBeNull();
  });
});

describe("pickBroadcast", () => {
  it("finds the one broadcast that names both schools near kickoff", () => {
    const pick = pickBroadcast(game("elmhurst", "washington-in-st-louis", "2026-09-07T18:00:00Z"), broadcasts, teams);
    expect(pick).toEqual({ url: "https://cciwnetwork.com/elmhurst/?B=4123942", candidates: 1 });
  });

  it("takes the broadcast closest to kickoff when the network holds two for one game", () => {
    const pick = pickBroadcast(game("elmhurst", "knox", "2026-09-05T21:00:00Z"), broadcasts, teams);
    expect(pick.candidates).toBe(2);
    expect(pick.url).toBe("https://cciwnetwork.com/elmhurst/?B=4123938");
  });

  it("does not use a broadcast from another day", () => {
    const pick = pickBroadcast(game("elmhurst", "knox", "2026-09-06T21:00:00Z"), broadcasts, teams);
    expect(pick).toEqual({ url: null, candidates: 0 });
  });

  it("ignores interview clips", () => {
    const pick = pickBroadcast(game("greenville", "wheaton", "2026-09-19T02:00:00Z"), broadcasts, teams);
    expect(pick.url).toBeNull();
  });

  it("ignores a broadcast that names another school", () => {
    const pick = pickBroadcast(game("wheaton", "pacific-lutheran", "2026-09-12T21:30:00Z"), broadcasts, teams);
    expect(pick.url).toBeNull();
  });

  it("ignores placeholders and a title that names only one side", () => {
    expect(pickBroadcast(game("elmhurst", "knox", "2026-08-06T15:44:00Z"), broadcasts, teams).url).toBeNull();
    expect(pickBroadcast(game("augustana", "knox", "2026-09-08T23:50:00Z"), broadcasts, teams).url).toBeNull();
  });

  it("takes the host from the site when the title leaves it out, and allows for hours of drift", () => {
    const list: Broadcast[] = [
      {
        id: "4128214",
        site: "northcentralcardinals",
        title: "Men's Soccer vs Carroll University",
        date: "2026-10-10T18:30:00+00:00",
        date_modified: null,
      },
    ];
    const withCarroll = [...teams, team("north-central", "North Central", "North Central College"), team("carroll", "Carroll", "Carroll University")];
    const pick = pickBroadcast(game("north-central", "carroll", "2026-10-10T21:30:00Z"), list, withCarroll);
    expect(pick.url).toBe("https://cciwnetwork.com/northcentralcardinals/?B=4128214");
    // The same title says nothing about a game between two other schools.
    expect(pickBroadcast(game("elmhurst", "carroll", "2026-10-10T21:30:00Z"), list, withCarroll).url).toBeNull();
  });

  it("finds nothing for a game with an undecided side", () => {
    const pick = pickBroadcast(game("elmhurst", null as unknown as string, "2026-09-05T21:00:00Z"), broadcasts, teams);
    expect(pick).toEqual({ url: null, candidates: 0 });
  });

  it("compares by day when the kickoff time isn't set", () => {
    const pick = pickBroadcast(
      game("elmhurst", "washington-in-st-louis", "2026-09-07T05:00:00Z", { time_tbd: true }),
      broadcasts,
      teams,
    );
    expect(pick.url).toBe("https://cciwnetwork.com/elmhurst/?B=4123942");
  });

  it("knows Concordia Chicago and MSOE by the names other schools give them", () => {
    const augustana = pickBroadcast(game("augustana", "concordia-chicago", "2026-09-09T00:00:00Z"), broadcasts, teams);
    expect(augustana.url).toBe("https://cciwnetwork.com/acvikings/?B=4399022");
    const list: Broadcast[] = [
      { id: "4171409", site: "northpark", title: "North Park University vs MSOE", date: "2026-09-07T23:45:00+00:00", date_modified: null },
    ];
    const pick = pickBroadcast(game("north-park", "milwaukee-school-of-engineering", "2026-09-08T00:00:00Z"), list, teams);
    expect(pick.url).toBe("https://cciwnetwork.com/northpark/?B=4171409");
  });

  it("links a broadcast on another conference's network to that network, with its school implied", () => {
    const list: Broadcast[] = [
      {
        id: "4391674",
        site: "stevenspoint",
        title: "Men's Soccer vs. Augustana",
        date: "2026-09-12T17:00:00+00:00",
        date_modified: null,
        portal: "https://wiacnetwork.com",
        team: "university-of-wisconsin-stevens-point",
      },
    ];
    const pick = pickBroadcast(
      game("university-of-wisconsin-stevens-point", "augustana", "2026-09-12T17:00:00Z"),
      list,
      teams,
    );
    expect(pick.url).toBe("https://wiacnetwork.com/stevenspoint/?B=4391674");
  });

  it("skips a broadcast the school has taken down", () => {
    const list: Broadcast[] = [
      { id: "1", site: "elmhurst", title: "Elmhurst vs Knox", date: "2026-09-05T21:00:00Z", date_modified: null, hidden: true },
      { id: "2", site: "elmhurst", title: "Elmhurst vs Knox", date: "2026-09-05T21:00:00Z", date_modified: null, available: false },
    ];
    expect(pickBroadcast(game("elmhurst", "knox", "2026-09-05T21:00:00Z"), list, teams).url).toBeNull();
  });

  it("ignores reserve games and scrimmages", () => {
    const list: Broadcast[] = [
      { id: "4578631", site: "elmhurst", title: "Reserves v Knox", date: "2026-09-05T21:00:00Z", date_modified: null },
    ];
    expect(pickBroadcast(game("elmhurst", "knox", "2026-09-05T21:00:00Z"), list, teams).url).toBeNull();
  });
});
