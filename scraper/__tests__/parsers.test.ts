import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyVideo } from "@/lib/video";
import { mergeGames, TeamResolver, type TeamRow } from "../merge";
import { centralToUtc, clockToMinute, firstLast, shortName } from "../normalize";
import { parseBoxScore } from "../sidearm/boxscore";
import { parsePosition, parseRoster, parseStats } from "../sidearm/roster";
import { parsePens, parseScoreboard, type SidearmGame } from "../sidearm/schedule";
import { buildBracket, type SlotRow } from "../tournament";

const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");
const feed = (school: string) =>
  parseScoreboard(
    JSON.parse(fixture(`scoreboard-${school}.json`)) as SidearmGame[],
    school,
    `https://${school}.example`,
    "2026-07-01",
  );

const team = (slug: string, name: string, aliases: string[], venue = ""): TeamRow => ({
  slug,
  name,
  full_name: aliases[0] ?? name,
  abbr: slug.slice(0, 3).toUpperCase(),
  venue,
  is_conference: true,
  sidearm_base_url: `https://${slug}.example`,
  sidearm_sport_id: 1,
  aliases,
  logo_url: null,
  logo_source_url: null,
});

const conference: TeamRow[] = [
  team("augustana", "Augustana", ["Augustana College", "Augustana", "Augustana College (IL)", "Augustana College (Ill.)"], "Thorson-Lucken Field"),
  team("carroll", "Carroll", ["Carroll University", "Carroll"]),
  team("carthage", "Carthage", ["Carthage College", "Carthage"]),
  team("elmhurst", "Elmhurst", ["Elmhurst University", "Elmhurst"]),
  team("illinois-wesleyan", "Illinois Wesleyan", ["Illinois Wesleyan University", "Illinois Wesleyan"]),
  team("millikin", "Millikin", ["Millikin University", "Millikin"]),
  team("north-central", "North Central", ["North Central College", "North Central"], "Benedetti-Wehrli Stadium"),
  team("north-park", "North Park", ["North Park University", "North Park"]),
  team("wheaton", "Wheaton", ["Wheaton College", "Wheaton", "Wheaton College (Ill.)"]),
];

const slots: SlotRow[] = [
  { season: 2026, slot: "qf1", round: "quarterfinal", home_seed: 3, away_seed: 6, home_from: null, away_from: null, match_id: null },
  { season: 2026, slot: "qf2", round: "quarterfinal", home_seed: 4, away_seed: 5, home_from: null, away_from: null, match_id: null },
  { season: 2026, slot: "sf1", round: "semifinal", home_seed: 1, away_seed: null, home_from: null, away_from: "qf2", match_id: null },
  { season: 2026, slot: "sf2", round: "semifinal", home_seed: 2, away_seed: null, home_from: null, away_from: "qf1", match_id: null },
  { season: 2026, slot: "final", round: "final", home_seed: null, away_seed: null, home_from: "sf1", away_from: "sf2", match_id: null },
];

describe("normalize", () => {
  it("reads the match clock the way soccer counts minutes", () => {
    expect(clockToMinute("08:26")).toBe(9);
    expect(clockToMinute("45:00")).toBe(45);
    expect(clockToMinute("90:12")).toBe(91);
  });

  it("flips surname-first names", () => {
    expect(firstLast("Valdes, Sebastian")).toBe("Sebastian Valdes");
    expect(firstLast("Sebastian Valdes")).toBe("Sebastian Valdes");
  });

  it("shortens opponent names", () => {
    expect(shortName("Loras College")).toBe("Loras");
    expect(shortName("University of Chicago")).toBe("University of Chicago");
    expect(shortName("Wheaton College (Mass.)")).toBe("Wheaton (Mass.)");
  });

  it("converts Central wall-clock times to UTC across DST", () => {
    expect(centralToUtc("2026-10-31T00:00:00")).toBe("2026-10-31T05:00:00.000Z");
    expect(centralToUtc("2026-12-05T00:00:00")).toBe("2026-12-05T06:00:00.000Z");
  });

  it("finds penalty shootout tallies", () => {
    expect(parsePens("(4-3 PK)")).toEqual([4, 3]);
    expect(parsePens(null, "Won 5-4 in PKs")).toEqual([5, 4]);
    expect(parsePens("2OT")).toBeNull();
  });
});

describe("scoreboard feed", () => {
  it("parses North Central's season", () => {
    const games = feed("north-central");
    expect(games).toHaveLength(21);
    const finals = games.filter((game) => game.status === "final");
    expect(finals.map((game) => `${game.teamScore}-${game.opponentScore}`)).toEqual([
      "3-1", "3-3", "1-0", "4-1", "3-1", "3-0",
    ]);
    expect(games.filter((game) => game.placeholderRound).map((game) => game.placeholderRound)).toEqual([
      "quarterfinal", "semifinal", "final",
    ]);
    expect(games[0].date).toBe("2026-09-02T00:00:00.000Z");
    expect(games.find((game) => game.gameId === 16817)?.boxscoreUrl).toBe(
      "https://north-central.example/boxscore.aspx?id=16817",
    );
  });

  it("drops exhibitions and NCAA placeholders", () => {
    const games = feed("illinois-wesleyan");
    expect(games.some((game) => /exhibition/i.test(game.opponentName))).toBe(false);
    expect(games.some((game) => game.kind === "ncaa")).toBe(false);
    expect(games.filter((game) => game.kind === "cciw")).toHaveLength(3);
    const tba = games.find((game) => game.placeholderRound === "quarterfinal");
    expect(tba?.timeTbd).toBe(true);
    expect(tba?.date).toBe("2026-10-31T05:00:00.000Z");
  });

  it("drops other teams' games at a hosted tournament", () => {
    expect(feed("wheaton").some((game) => / vs\.? /i.test(game.opponentName))).toBe(false);
  });

  it("keeps canceled games", () => {
    expect(feed("augustana")[0].status).toBe("canceled");
  });
});

describe("merge", () => {
  const resolver = () => new TeamResolver(structuredClone(conference));

  it("collapses both schools' views of a conference game", () => {
    const { matches } = mergeGames([...feed("augustana"), ...feed("carroll")], resolver());
    const game = matches.filter(
      (match) => [match.home_slug, match.away_slug].sort().join() === "augustana,carroll",
    );
    expect(game).toHaveLength(1);
    expect(game[0].home_slug).toBe("augustana");
    expect(game[0].is_conference).toBe(true);
    // Host's kickoff (5 PM Central) wins over the visitor's listing.
    expect(game[0].date).toBe("2026-09-26T22:00:00.000Z");
    // Augustana lists no stream; Carroll's listing points at Augustana's.
    expect(game[0].video_url).toBe("https://cciwnetwork.com/acvikings/");
    expect(game[0].venue).toBe("Thorson-Lucken Field");
  });

  it("creates one team per non-conference opponent", () => {
    const teams = resolver();
    mergeGames([...feed("carroll"), ...feed("wheaton")], teams);
    expect(teams.created.has("university-of-chicago")).toBe(true);
    expect(teams.created.get("loras")?.name).toBe("Loras");
  });

  it("keeps the score with the right side", () => {
    const { matches } = mergeGames(feed("north-central"), resolver());
    const iit = matches.find((match) => match.id.includes("illinois-institute-of-technology"));
    expect(iit?.home_slug).toBe("illinois-institute-of-technology");
    expect([iit?.home_score, iit?.away_score]).toEqual([1, 3]);
  });
});

describe("bracket", () => {
  const names = (slug: string) => slug;

  it("adds TBC placeholders before anything is decided", () => {
    const { matches, placeholders } = mergeGames(feed("north-central"), new TeamResolver(structuredClone(conference)));
    const result = buildBracket({
      matches,
      placeholders,
      slots: structuredClone(slots),
      officialSeeds: null,
      conferenceSlugs: conference.map((row) => row.slug),
      nameOf: names,
    });
    const tbc = result.matches.filter((match) => match.bracket_slot);
    expect(tbc.map((match) => match.bracket_slot)).toEqual(["qf1", "qf2", "sf1", "sf2", "final"]);
    expect(tbc.every((match) => match.home_slug === null && match.away_slug === null)).toBe(true);
    expect(tbc[2].away_placeholder).toBe("Winner QF2");
    expect(result.seeds).toHaveLength(0);
  });

  it("slots real games in and advances winners", () => {
    const seeds = { 1: "wheaton", 2: "illinois-wesleyan", 3: "north-central", 4: "north-park", 5: "carroll", 6: "carthage" };
    const base = {
      season: 2026, home_placeholder: null, away_placeholder: null, home_pens: null, away_pens: null,
      venue: "", is_conference: false, stage: "regular" as const, bracket_slot: null, video_url: null,
      boxscore_url: null, recap_url: null, source_game_id: 1, cciw: true,
    };
    const qf1 = { ...base, id: "qf1", date: "2026-10-31T19:00:00.000Z", status: "final" as const, home_slug: "north-central", away_slug: "carthage", home_score: 1, away_score: 1, home_pens: 3, away_pens: 4, source_school: "north-central" };
    const qf2 = { ...base, id: "qf2", date: "2026-10-31T22:00:00.000Z", status: "final" as const, home_slug: "north-park", away_slug: "carroll", home_score: 2, away_score: 1, source_school: "north-park" };
    const { matches } = mergeGames([], new TeamResolver(structuredClone(conference)));
    const result = buildBracket({
      matches: [...matches, qf1, qf2],
      placeholders: [],
      slots: structuredClone(slots),
      officialSeeds: seeds,
      conferenceSlugs: conference.map((row) => row.slug),
      nameOf: names,
    });
    expect(result.matches.find((match) => match.id === "qf1")?.bracket_slot).toBe("qf1");
    // No calendar for later rounds without placeholders: no TBC rows, but the
    // slots still resolve their teams once a date is known.
    expect(result.slots.find((slot) => slot.slot === "qf2")?.match_id).toBe("qf2");
    expect(result.seeds.every((seed) => seed.is_official)).toBe(true);
  });
});

describe("box score", () => {
  it("parses goals, cards, lineups and game info", () => {
    const box = parseBoxScore(fixture("boxscore-millikin.html"));
    expect(box.abbr).toEqual({ away: "MIL", home: "WSH" });
    expect(box.totals).toEqual({ away: 0, home: 5 });
    expect(box.events[0]).toEqual({
      minute: 9,
      type: "goal",
      side: "home",
      playerName: "Sebastian Valdes",
      assistName: "Ethan Wirtschafter",
    });
    expect(box.events.filter((event) => event.type === "yellow")).toHaveLength(2);
    expect(box.lineups.filter((entry) => entry.side === "away" && entry.starter)).toHaveLength(11);
    expect(box.lineups[0]).toMatchObject({ name: "Aidan Welch", number: 2, position: "D", sidearmId: 12260 });
    expect(box.attendance).toBe(81);
    expect(box.stadium).toBe("Francis Olympic Field");
  });

  it("recognises own goals and the referee", () => {
    const box = parseBoxScore(fixture("boxscore-north-central.html"));
    const own = box.events.find((event) => event.type === "own-goal");
    expect(own).toMatchObject({ side: "home", playerName: "Own goal" });
    expect(box.referee).toBe("Alex Beehler");
    expect(box.totals).toEqual({ away: 1, home: 4 });
  });

  it("handles a goalless game", () => {
    const box = parseBoxScore(fixture("boxscore-illinois-wesleyan.html"));
    expect(box.events.filter((event) => event.type !== "yellow" && event.type !== "red")).toHaveLength(0);
    expect(box.totals).toEqual({ away: 0, home: 0 });
  });
});

describe("roster and stats", () => {
  it("reads roster tables with different column sets", () => {
    const wheaton = parseRoster(fixture("roster-wheaton.html"));
    expect(wheaton.length).toBeGreaterThan(20);
    expect(wheaton[0]).toMatchObject({ number: 0, name: "Oliver Van Eaton", position: null, year: "So." });

    const ncc = parseRoster(fixture("roster-north-central.html"));
    expect(ncc[0]).toMatchObject({ name: "Jack Orris", position: "GK", height: "", hometown: "Southgate, Mich." });
  });

  it("reads season stats", () => {
    const stats = parseStats(fixture("stats-north-central.html"));
    expect(stats.find((line) => line.name === "Joseph Sargent")).toMatchObject({
      sidearmId: 19170, gp: 6, gs: 6, goals: 5, assists: 1,
    });
    expect(parseStats(fixture("stats-wheaton.html")).find((line) => line.name === "Luke McGuire")?.goalkeeper).toBe(true);
  });

  it("maps position labels", () => {
    expect(parsePosition("M/F")).toBe("M");
    expect(parsePosition("GK")).toBe("GK");
    expect(parsePosition("")).toBeNull();
  });
});

describe("video", () => {
  it("embeds only specific YouTube videos", () => {
    expect(classifyVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.embedUrl).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    const channel = classifyVideo("https://www.youtube.com/@WheatonThunder");
    expect(channel?.provider).toBe("youtube");
    expect(channel?.embedUrl).toBeUndefined();
    expect(classifyVideo("https://www.cciwnetwork.com/northcentralcardinals/?B=4128208")?.label).toBe(
      "Watch on CCIW Network",
    );
    expect(classifyVideo("https://www.wiacnetwork.com/stevenspoint/?B=4391674")?.provider).toBe("hudl");
    expect(classifyVideo("not a url")).toBeUndefined();
  });
});

describe("box score placeholder players", () => {
  const html = `
    <table><caption>NCC - Player Stats</caption></table>
    <table><caption>KAL - Player Stats</caption></table>
    <table><caption>Scoring Summary</caption><tbody>
      <tr><td>12:55</td><td><span class="hide">NCC</span></td>
        <td><span class='text-bold'>0</span><br><span class="text-capitalize">Off a corner kick.</span></td></tr>
      <tr><td>30:00</td><td><span class="hide">KAL</span></td>
        <td><span class='text-bold'>Ryan Clark (2)</span><br><span class="text-capitalize">Goal.</span></td></tr>
    </tbody></table>
    <table><caption>Cautions and Ejections</caption><tbody>
      <tr><td class="penalty-type red"></td><td>42:23</td><td>NCC</td><td>#0 0</td></tr>
      <tr><td class="penalty-type yellow"></td><td>43:00</td><td>KAL</td><td>#15 Micah Amega</td></tr>
    </tbody></table>`;

  it("reads a blank player (printed as 0) as unknown, not as a name", () => {
    const { events } = parseBoxScore(html);
    expect(events.map((event) => event.playerName)).toEqual(["Unknown", "Ryan Clark", "Unknown", "Micah Amega"]);
  });
});
