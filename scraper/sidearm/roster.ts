import * as cheerio from "cheerio";
import type { Position } from "@/lib/types";
import { cleanText, firstLast, toInt } from "../normalize";

/**
 * Roster (`/sports/mens-soccer/roster/<season>?view=2`, the table view) and
 * season stats (`/sports/mens-soccer/stats/<season>`). Column sets differ per
 * school, so roster cells are read by their SIDEARM class names.
 */

export type RosterPlayer = {
  sidearmId: number | null;
  number: number | null;
  name: string;
  position: Position | null;
  year: string;
  hometown: string;
  height: string;
  /** Site-relative, without the resize query. */
  photoPath: string | null;
  bioPath: string | null;
  /** "Midfielder/Forward", as the roster card spells it out. */
  positionLong: string;
  weight: string;
  highSchool: string;
  previousSchool: string;
  major: string;
  captain: boolean;
};

export type KeeperLine = {
  minutes: number;
  goalsAgainst: number;
  saves: number;
  wins: number;
  losses: number;
  ties: number;
  shutouts: number;
};

export type StatLine = {
  sidearmId: number | null;
  number: number | null;
  name: string;
  gp: number;
  gs: number;
  goals: number;
  assists: number;
  /** Null where the school's table leaves the column out. */
  minutes: number | null;
  shots: number | null;
  shotsOnGoal: number | null;
  gameWinners: number | null;
  pkGoals: number | null;
  pkAttempts: number | null;
  yellow: number | null;
  red: number | null;
  goalkeeper: boolean;
  /** Only for players listed in the goalkeeping table. */
  keeper: KeeperLine | null;
};

export function rosterUrl(baseUrl: string, season: number): string {
  return `${baseUrl}/sports/mens-soccer/roster/${season}?view=2`;
}

export function statsUrl(baseUrl: string, season: number): string {
  return `${baseUrl}/sports/mens-soccer/stats/${season}`;
}

export function parsePosition(value: string): Position | null {
  const clean = cleanText(value).toUpperCase();
  // "M/F", "D/M": the first listed role wins.
  const first = clean.split(/[\/,\s]+/)[0];
  if (["GK", "G", "GOALKEEPER", "KEEPER"].includes(first)) return "GK";
  if (["D", "DEF", "B", "DEFENDER", "DEFENSE"].includes(first)) return "D";
  if (["M", "MF", "MID", "MIDFIELDER", "MIDFIELD"].includes(first)) return "M";
  if (["F", "FW", "FWD", "FORWARD", "S", "ST", "STRIKER", "A"].includes(first)) return "F";
  return null;
}

type Card = { photoPath: string | null; positionLong: string; highSchool: string; major: string };

/** Drops the resize query, and the placeholder silhouette schools serve for no headshot. */
function photoPath(src: string): string | null {
  return src && !/placeholder|default|missing|no[-_]?image|\.svg/i.test(src) ? src.split("?")[0] : null;
}

/**
 * The card view sits on the same page as the table (hidden), and is the only
 * place with the headshot, the spelled-out position and the major. Keyed by
 * the SIDEARM player id both views link to.
 */
function readCards($: cheerio.CheerioAPI): Map<number, Card> {
  const cards = new Map<number, Card>();
  $(".sidearm-roster-player[data-player-id]").each((_, element) => {
    const card = $(element);
    const id = toInt(card.attr("data-player-id"));
    if (id === null) return;
    const image = card.find(".sidearm-roster-player-image img").first();
    const src = image.attr("data-src") || image.attr("src") || "";
    const position = card.find(".sidearm-roster-player-position .text-bold").first();
    // Some cards carry a long and a short label side by side; keep the long one.
    const long = position.find(".sidearm-roster-player-position-long-short").first();
    cards.set(id, {
      photoPath: photoPath(src),
      positionLong: cleanText((long.length ? long : position).text()),
      highSchool: cleanText(card.find(".sidearm-roster-player-highschool").first().text()),
      major: cleanText(card.find(".sidearm-roster-player-player-major").first().text()),
    });
  });

  // A third view, the list cards, is the only one with the major on some sites.
  $(".sidearm-list-card-item[data-player-id]").each((_, element) => {
    const item = $(element);
    const id = toInt(item.attr("data-player-id"));
    if (id === null) return;
    const style = item.find(".sidearm-roster-player-image").first().attr("style") ?? "";
    const card = cards.get(id) ?? { photoPath: null, positionLong: "", highSchool: "", major: "" };
    cards.set(id, {
      ...card,
      photoPath: card.photoPath ?? photoPath(style.match(/url\(['"]?([^'")]+)/)?.[1] ?? ""),
      major: card.major || cleanText(item.find(".sidearm-roster-player-player-major").first().text()),
    });
  });
  return cards;
}

export function parseRoster(html: string): RosterPlayer[] {
  const $ = cheerio.load(html);
  const table = $("table")
    .filter((_, element) => /Roster$/i.test(cleanText($(element).find("caption").first().text())))
    .first();
  const cards = readCards($);

  const players: RosterPlayer[] = [];
  table.find("tbody tr").each((_, row) => {
    const cell = (className: string) => $(row).find(`td.${className}`).first();
    const nameCell = cell("sidearm-table-player-name");
    const name = cleanText(nameCell.find("a").first().text() || nameCell.text());
    if (!name) return;

    const [town, school] = cell("hometownhighschool").text().split(" / ");
    const hometown = cleanText(cell("player_hometown").text() || town);
    const height = cleanText(cell("height").text());
    const weight = cleanText(cell("rp_weight").text());
    const bioPath = nameCell.find("a").attr("href") ?? null;
    const sidearmId = toInt(bioPath?.split("/").pop());
    const card = sidearmId !== null ? cards.get(sidearmId) : undefined;

    players.push({
      sidearmId,
      number: toInt(cell("roster_jerseynum").text()),
      name: firstLast(name),
      position: parsePosition(cell("rp_position_short").text()),
      year: cleanText(cell("roster_class").text()),
      hometown,
      height: height === "-" ? "" : height,
      photoPath: card?.photoPath ?? null,
      bioPath,
      positionLong: card?.positionLong ?? "",
      weight: weight === "-" ? "" : weight,
      highSchool: cleanText(cell("player_highschool").text() || school) || card?.highSchool || "",
      previousSchool: cleanText(cell("player_previous_school").text()),
      major: card?.major ?? "",
      captain: /\S/.test(cell("rp_captain").text()),
    });
  });

  return players;
}

export function parseStats(html: string): StatLine[] {
  const $ = cheerio.load(html);
  const lines = new Map<string, StatLine>();

  const read = (caption: string, goalkeeper: boolean) => {
    const table = $("table")
      .filter((_, element) => cleanText($(element).find("caption").first().text()) === caption)
      .first();

    table.find("tbody tr").each((_, row) => {
      const link = $(row).find("a[data-player-id]").first();
      if (!link.length) return; // Totals and opponent rows.
      const name = firstLast(link.text());
      const sidearmId = toInt(link.attr("data-player-id"));
      const text = (label: string) => {
        const td = $(row).find(`td[data-label="${label}"]`).first();
        return td.length ? td.text() : null;
      };
      /** A column's number, or null when the table has no such column. */
      const optional = (label: string) => {
        const value = text(label);
        return value === null ? null : (toInt(value) ?? 0);
      };
      const stat = (label: string) => optional(label) ?? 0;
      /** One half of a paired column such as "YC-RC" (1-0) or "SHO/CBO" (0/1). */
      const pair = (label: string, index: 0 | 1) => {
        const value = text(label);
        return value === null ? null : (toInt(value.split(/[-\/]/)[index]) ?? 0);
      };
      const key = sidearmId !== null ? `id:${sidearmId}` : `name:${name}`;

      const keeper: KeeperLine | null = goalkeeper
        ? {
            // "540:00": minutes and seconds.
            minutes: stat("MIN"),
            goalsAgainst: stat("GA"),
            saves: stat("SV"),
            wins: stat("W"),
            losses: stat("L"),
            ties: stat("T"),
            shutouts: pair("SHO/CBO", 0) ?? stat("SHO"),
          }
        : null;

      const existing = lines.get(key);
      if (existing) {
        // Keepers appear in both tables; the outfield table carries G and A.
        existing.goalkeeper ||= goalkeeper;
        existing.keeper ??= keeper;
        existing.gp = Math.max(existing.gp, stat("GP"));
        existing.gs = Math.max(existing.gs, stat("GS"));
        return;
      }
      lines.set(key, {
        sidearmId,
        number: toInt($(row).find("td").first().text()),
        name,
        gp: stat("GP"),
        gs: stat("GS"),
        goals: goalkeeper ? 0 : stat("G"),
        assists: goalkeeper ? 0 : stat("A"),
        minutes: goalkeeper ? null : optional("MIN"),
        shots: goalkeeper ? null : optional("SH"),
        shotsOnGoal: goalkeeper ? null : optional("SOG"),
        gameWinners: goalkeeper ? null : optional("GW"),
        pkGoals: goalkeeper ? null : pair("PG-PA", 0),
        pkAttempts: goalkeeper ? null : pair("PG-PA", 1),
        yellow: goalkeeper ? null : pair("YC-RC", 0),
        red: goalkeeper ? null : pair("YC-RC", 1),
        goalkeeper,
        keeper,
      });
    });
  };

  read("Individual Overall Offensive Statistics", false);
  read("Individual Overall Goalkeeping Statistics", true);
  return [...lines.values()];
}
