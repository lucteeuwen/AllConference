import * as cheerio from "cheerio";
import { cleanText } from "./normalize";

/**
 * A United Soccer Coaches NCAA DIII poll (see SPORT_SOURCES). The page holds
 * every poll of the season as a table each, newest first; only the first is
 * current.
 */

export type PollEntry = { rank: number; school: string };

export function parseNationalPoll(html: string): PollEntry[] {
  const $ = cheerio.load(html);
  const entries: PollEntry[] = [];
  $("table.rankingsTable")
    .first()
    .find("tbody tr")
    .each((_, row) => {
      const rank = Number($(row).find("td.tdRank").text().trim());
      const school = cleanText($(row).find("td.tdSchool").text());
      if (Number.isInteger(rank) && rank > 0 && school) entries.push({ rank, school });
    });
  return entries;
}
