import * as cheerio from "cheerio";
import type { MatchEventType } from "@/lib/types";
import { cleanText, clockToMinute, firstLast, toInt } from "../normalize";

/**
 * SIDEARM soccer box score (`/boxscore.aspx?id=`). Every CCIW school renders
 * the same template: tables are captioned, and the visiting team is always
 * listed before the home team.
 */

export type BoxSide = "home" | "away";

export type BoxEvent = {
  minute: number;
  type: MatchEventType;
  side: BoxSide | null;
  playerName: string;
  assistName?: string;
};

export type BoxLineupEntry = {
  side: BoxSide;
  starter: boolean;
  number: number | null;
  name: string;
  position: string | null;
  sidearmId: number | null;
};

export type BoxScore = {
  /** Team abbreviations as the box score prints them. */
  abbr: Record<BoxSide, string>;
  totals: Record<BoxSide, number | null>;
  /** Goals per period, e.g. [1, 2] or [1, 1, 0] with overtime. */
  periods: Record<BoxSide, number[]>;
  events: BoxEvent[];
  lineups: BoxLineupEntry[];
  attendance: number | null;
  referee: string | null;
  stadium: string | null;
};

const POSITIONS: Record<string, string> = { GK: "GK", DEF: "D", MID: "M", FWD: "F", D: "D", M: "M", F: "F" };

type Cheerio = cheerio.CheerioAPI;

function tableByCaption($: Cheerio, test: (caption: string) => boolean) {
  return $("table")
    .filter((_, table) => test(cleanText($(table).find("caption").first().text())))
    .toArray()
    .map((table) => $(table));
}

/**
 * A school that never entered a player leaves the name blank, which its box
 * score prints as a bare "0" (or the jersey number). That is not a name.
 */
export function playerOrUnknown(name: string): string {
  const clean = cleanText(name);
  return /^\d*$/.test(clean) || /^unknown$/i.test(clean) ? "Unknown" : clean;
}

function stripTally(name: string): string {
  // "Sebastian Valdes (2)" carries the season tally.
  return cleanText(name.replace(/\(\d+\)\s*$/, ""));
}

export function parseBoxScore(html: string): BoxScore {
  const $ = cheerio.load(html);

  // Player tables are captioned "<ABBR> - Player Stats", visitors first.
  const playerTables = tableByCaption($, (caption) => / - Player Stats$/i.test(caption));
  const abbrs = playerTables.map((table) =>
    cleanText(table.find("caption").first().text()).replace(/ - Player Stats$/i, ""),
  );
  const abbr: Record<BoxSide, string> = { away: abbrs[0] ?? "", home: abbrs[1] ?? "" };

  const sideForAbbr = (value: string): BoxSide | null => {
    const clean = cleanText(value).toUpperCase();
    if (clean && clean === abbr.home.toUpperCase()) return "home";
    if (clean && clean === abbr.away.toUpperCase()) return "away";
    return null;
  };

  // Score by period.
  const periods: Record<BoxSide, number[]> = { away: [], home: [] };
  const totals: Record<BoxSide, number | null> = { away: null, home: null };
  const [scoreTable] = tableByCaption($, (caption) => caption === "Team Score By Period");
  scoreTable?.find("tbody tr").each((index, row) => {
    const side: BoxSide = index === 0 ? "away" : "home";
    const cells = $(row).find("td").toArray().map((cell) => toInt($(cell).text()));
    totals[side] = cells.at(-1) ?? null;
    periods[side] = cells.slice(0, -1).map((value) => value ?? 0);
  });

  const events: BoxEvent[] = [];

  const [scoring] = tableByCaption($, (caption) => caption === "Scoring Summary");
  scoring?.find("tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 3) return;
    const minute = clockToMinute(cells.eq(0).text());
    const side = sideForAbbr(cells.eq(1).find(".hide").text() || cells.eq(1).text());
    const detail = cells.eq(2);
    const description = cleanText(detail.find(".text-capitalize").text());
    const scorer = stripTally(detail.find(".text-bold").first().text());
    const assist = cleanText(detail.find(".text-italic").first().text())
      .replace(/^Assisted By:\s*/i, "")
      .split(/;|\band\b/)[0]
      .trim();

    const ownGoal = /\bTEAM\.?$|own goal|\bOG\b/i.test(description);
    const type: MatchEventType = ownGoal
      ? "own-goal"
      : /penalty kick|\bPK\b/i.test(description)
        ? "penalty"
        : "goal";

    events.push({
      minute,
      type,
      side,
      playerName: ownGoal ? "Own goal" : playerOrUnknown(scorer),
      assistName: assist && !/unassisted/i.test(assist) ? assist : undefined,
    });
  });

  const [cautions] = tableByCaption($, (caption) => caption === "Cautions and Ejections");
  cautions?.find("tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 4) return;
    const kind = cells.eq(0).attr("class") ?? "";
    const player = cleanText(cells.eq(3).text()).replace(/^#\s*\d+\s*/, "");
    events.push({
      minute: clockToMinute(cells.eq(1).text()),
      type: /red/i.test(kind) ? "red" : "yellow",
      side: sideForAbbr(cells.eq(2).text()),
      playerName: playerOrUnknown(firstLast(player)),
    });
  });

  events.sort((a, b) => a.minute - b.minute);

  // Lineups from the player tables' Starters / Substitutes groups.
  const lineups: BoxLineupEntry[] = [];
  playerTables.forEach((table, index) => {
    const side: BoxSide = index === 0 ? "away" : "home";
    let group: "Starters" | "Substitutes" | null = null;
    table.find("tbody tr").each((_, row) => {
      const header = $(row).find("th.header-group");
      if (header.length) {
        const label = cleanText(header.text());
        group = label === "Starters" || label === "Substitutes" ? label : null;
        return;
      }
      if (!group) return;
      const cells = $(row).find("td");
      const link = cells.find("a.boxscore_player_link");
      const nameCell = link.length ? link.text() : cells.eq(2).clone().children(".mobile-jersey-number").remove().end().text();
      const name = firstLast(nameCell);
      if (!name || /^(team|totals?)$/i.test(name)) return;
      const position = cleanText(cells.eq(0).text()).toUpperCase();
      lineups.push({
        side,
        starter: group === "Starters",
        number: toInt(cells.eq(1).text()),
        name,
        position: POSITIONS[position] ?? null,
        sidearmId: toInt(link.attr("href")?.split("/").pop()),
      });
    });
  });

  // The game-info list: <dt>Attendance:</dt><dd>81</dd>, officials as dd's.
  let attendance: number | null = null;
  let stadium: string | null = null;
  let referee: string | null = null;
  $("dl dt").each((_, dt) => {
    const label = cleanText($(dt).text());
    const value = cleanText($(dt).next("dd").text());
    if (label === "Attendance:") attendance = toInt(value.replace(/,/g, ""));
    if (label === "Stadium:") stadium = value || null;
    if (label === "Officials") {
      $(dt)
        .nextUntil("dt", "dd")
        .each((_, dd) => {
          const text = cleanText($(dd).text());
          const match = text.match(/^Referee:\s*(.+)$/i);
          if (match && !referee) referee = match[1];
        });
    }
  });

  return { abbr, totals, periods, events, lineups, attendance, referee, stadium };
}
