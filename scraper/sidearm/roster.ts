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
};

export type StatLine = {
  sidearmId: number | null;
  number: number | null;
  name: string;
  gp: number;
  gs: number;
  goals: number;
  assists: number;
  goalkeeper: boolean;
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

export function parseRoster(html: string): RosterPlayer[] {
  const $ = cheerio.load(html);
  const table = $("table")
    .filter((_, element) => /Roster$/i.test(cleanText($(element).find("caption").first().text())))
    .first();

  const players: RosterPlayer[] = [];
  table.find("tbody tr").each((_, row) => {
    const cell = (className: string) => $(row).find(`td.${className}`).first();
    const nameCell = cell("sidearm-table-player-name");
    const name = cleanText(nameCell.find("a").first().text() || nameCell.text());
    if (!name) return;

    const hometown = cleanText(
      cell("player_hometown").text() || cell("hometownhighschool").text().split(" / ")[0],
    );
    const height = cleanText(cell("height").text());

    players.push({
      sidearmId: toInt(nameCell.find("a").attr("href")?.split("/").pop()),
      number: toInt(cell("roster_jerseynum").text()),
      name: firstLast(name),
      position: parsePosition(cell("rp_position_short").text()),
      year: cleanText(cell("roster_class").text()),
      hometown,
      height: height === "-" ? "" : height,
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
      const stat = (label: string) => toInt($(row).find(`td[data-label="${label}"]`).first().text()) ?? 0;
      const key = sidearmId !== null ? `id:${sidearmId}` : `name:${name}`;

      const existing = lines.get(key);
      if (existing) {
        // Keepers appear in both tables; the outfield table carries G and A.
        existing.goalkeeper ||= goalkeeper;
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
        goalkeeper,
      });
    });
  };

  read("Individual Overall Offensive Statistics", false);
  read("Individual Overall Goalkeeping Statistics", true);
  return [...lines.values()];
}
