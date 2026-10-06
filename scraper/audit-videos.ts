import "./env";
import { SEASON } from "./config";
import { createDb, must } from "./db";
import type { MatchRecord, TeamRow } from "./merge";
import { resolveWatchLinks } from "./watch";

/**
 * npm run videos:audit
 *
 * Shows, for every match this season, the stream link a scrape would store now
 * and why, next to the one stored. Read-only: nothing is written.
 */

type Row = Pick<
  MatchRecord,
  "id" | "date" | "status" | "home_slug" | "away_slug" | "time_tbd" | "video_url" | "broadcast_url"
>;

async function main() {
  const db = createDb(true);
  const teams = await must<Pick<TeamRow, "slug" | "name" | "full_name" | "is_conference" | "aliases">[]>(
    db.from("teams").select("slug, name, full_name, is_conference, aliases"),
    "load teams",
  );
  const matches = await must<Row[]>(
    db
      .from("matches")
      .select("id, date, status, home_slug, away_slug, time_tbd, video_url, broadcast_url")
      .eq("season", SEASON)
      .order("date"),
    "load matches",
  );

  const results = await resolveWatchLinks(matches, {
    teams: teams.map((team) => ({
      slug: team.slug,
      name: team.name,
      fullName: team.full_name,
      aliases: team.is_conference ? team.aliases : [],
    })),
    log: (message) => console.error(message),
  });

  const counts = new Map<string, number>();
  for (const match of matches) {
    const result = results.get(match.id);
    if (!result) continue;
    const url = result.settled ? result.url : match.broadcast_url;
    const changed = url !== match.broadcast_url ? "*" : " ";
    const key = !result.settled ? "kept (platform not asked)" : result.url ? `link: ${result.source}` : "none";
    counts.set(key, (counts.get(key) ?? 0) + 1);
    console.log(
      [
        changed,
        match.date.slice(0, 10),
        match.status.padEnd(9),
        `${match.home_slug ?? "?"} v ${match.away_slug ?? "?"}`.padEnd(60),
        (url ?? "-").padEnd(50),
        result.reason,
      ].join("  "),
    );
  }
  console.log(`\n${matches.length} matches (* = differs from what is stored)`);
  for (const [key, value] of counts) console.log(`  ${key}: ${value}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
