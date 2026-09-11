import type { RailTile } from "@/components/broadcast/ScoreboardRail";
import { formatKickoff } from "@/lib/format";
import { requireTeam } from "@/lib/selectors";
import type { HomeData } from "@/lib/home";
import type { Match } from "@/lib/types";

/**
 * Turns matches into scoreboard-rail tiles. Deduplicates on the way through,
 * because today's finished games appear in more than one of the home page's
 * lists.
 */
export function buildRailTiles(
  matches: Match[],
  standings: HomeData["standings"],
  limit = 12,
): RailTile[] {
  const records = new Map(
    standings.map((line) => [
      line.team.slug,
      `${line.row.overall.w}-${line.row.overall.l}-${line.row.overall.d}`,
    ]),
  );

  const seen = new Set<string>();

  return matches
    .filter((match) => !seen.has(match.id) && seen.add(match.id))
    .slice(0, limit)
    .map((match) => {
      const home = requireTeam(match.home.teamSlug);
      const away = requireTeam(match.away.teamSlug);
      const decided =
        match.status === "final" && match.home.score !== null && match.away.score !== null;

      return {
        id: match.id,
        live: match.status === "live",
        status:
          match.status === "live"
            ? `${match.minute}'`
            : match.status === "final"
              ? "Final"
              : match.status === "postponed"
                ? "PPD"
                : formatKickoff(match.date),
        note: match.isConference ? "CCIW" : "Non-conf",
        home: { team: home, score: match.home.score, record: records.get(home.slug) ?? "0-0-0" },
        away: { team: away, score: match.away.score, record: records.get(away.slug) ?? "0-0-0" },
        winner: !decided
          ? null
          : (match.home.score as number) > (match.away.score as number)
            ? "home"
            : (match.away.score as number) > (match.home.score as number)
              ? "away"
              : null,
      };
    });
}
