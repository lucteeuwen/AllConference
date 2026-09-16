import type { RailTile } from "@/components/broadcast/ScoreboardRail";
import { formatKickoff } from "@/lib/format";
import type { StandingsLine } from "@/lib/selectors";
import type { Match } from "@/lib/types";

/**
 * Turns matches into scoreboard-rail tiles. Deduplicates on the way through,
 * because today's finished games appear in more than one of the home page's
 * lists.
 */
export function buildRailTiles(
  matches: Match[],
  standings: StandingsLine[],
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
    .filter((match) => match.status !== "canceled")
    .slice(0, limit)
    .map((match) => {
      const decided =
        match.status === "final" && match.home.score !== null && match.away.score !== null;
      const homeWins =
        decided &&
        ((match.home.score as number) > (match.away.score as number) ||
          (match.home.score === match.away.score && (match.home.pens ?? 0) > (match.away.pens ?? 0)));
      const awayWins =
        decided &&
        ((match.away.score as number) > (match.home.score as number) ||
          (match.home.score === match.away.score && (match.away.pens ?? 0) > (match.home.pens ?? 0)));

      return {
        id: match.id,
        live: match.status === "live",
        status:
          match.status === "live"
            ? match.minute
              ? `${match.minute}'`
              : "Live"
            : match.status === "final"
              ? "Full time"
              : match.status === "postponed"
                ? "PPD"
                : formatKickoff(match.date),
        note:
          match.stage === "regular"
            ? match.isConference
              ? "CCIW"
              : "Non-conf"
            : match.stage === "ncaa"
              ? "NCAA"
              : "CCIW Tourn.",
        home: {
          team: match.home.team,
          score: match.home.score,
          // A TBC side shows what it is waiting on where the record would be.
          record: match.home.teamSlug ? (records.get(match.home.teamSlug) ?? "") : (match.home.placeholder ?? ""),
        },
        away: {
          team: match.away.team,
          score: match.away.score,
          record: match.away.teamSlug ? (records.get(match.away.teamSlug) ?? "") : (match.away.placeholder ?? ""),
        },
        winner: homeWins ? "home" : awayWins ? "away" : null,
      };
    });
}
