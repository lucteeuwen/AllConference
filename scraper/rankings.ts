import * as cheerio from "cheerio";
import { cleanText } from "./normalize";

/**
 * The United Soccer Coaches NCAA DIII men's poll. The page holds every poll of
 * the season as a table each, newest first; only the first is current.
 */
export const POLL_URL = "https://unitedsoccercoaches.org/?p=12373";

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
