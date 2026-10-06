import { describe, expect, it } from "vitest";
import { parseNationalPoll } from "../rankings";

const row = (rank: number, school: string) =>
  `<tr><td class="tdRank">${rank}</td><td class="tdSchool">\n   ${school}   </td><td class="tdPrev">1</td></tr>`;
const table = (id: number, rows: string) =>
  `<table class="rankingsTable" id="poll-id-${id}"><thead><tr><th>Rank</th></tr></thead><tbody>${rows}</tbody></table>`;

describe("parseNationalPoll", () => {
  it("reads only the newest poll, trimming school names", () => {
    const html = table(2, row(1, "St. Olaf College") + row(2, "Wheaton College (Mass.)")) + table(1, row(1, "Old Team"));
    expect(parseNationalPoll(html)).toEqual([
      { rank: 1, school: "St. Olaf College" },
      { rank: 2, school: "Wheaton College (Mass.)" },
    ]);
  });

  it("returns nothing when the page has no poll", () => {
    expect(parseNationalPoll("<html></html>")).toEqual([]);
  });
});
