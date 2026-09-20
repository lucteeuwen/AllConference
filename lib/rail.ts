import type { RailTile } from "@/components/broadcast/ScoreboardRail";
import type { StandingsLine } from "@/lib/selectors";
import type { Match } from "@/lib/types";

/**
 * Turns matches into scoreboard-rail tiles. Deduplicates on the way through,
 * because today's finished games appear in more than one of the home page's
 * lists. Sorts chronologically and, when trimming to `limit`, keeps a window
 * centered on the live/next match so the rail can rest scrolled there rather
 * than always starting at the oldest result.
 */
export function buildRailTiles(
  matches: Match[],
  standings: StandingsLine[],
  limit = 12,
  now: number = Date.now(),
): { tiles: RailTile[]; centerIndex: number } {
  const records = new Map(
    standings.map((line) => [
      line.team.slug,
      `${line.row.overall.w}-${line.row.overall.l}-${line.row.overall.d}`,
    ]),
  );

  const seen = new Set<string>();

  const sorted = matches
    .filter((match) => !seen.has(match.id) && seen.add(match.id))
    .filter((match) => match.status !== "canceled")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (sorted.length === 0) return { tiles: [], centerIndex: -1 };

  const liveIndex = sorted.findIndex((match) => match.status === "live");
  const nextIndex = sorted.findIndex(
    (match) => match.status === "scheduled" && new Date(match.date).getTime() >= now,
  );
  const anchorIndex = liveIndex !== -1 ? liveIndex : nextIndex !== -1 ? nextIndex : sorted.length - 1;

  let start = 0;
  let end = sorted.length;
  if (sorted.length > limit) {
    const half = Math.floor(limit / 2);
    start = Math.min(Math.max(anchorIndex - half, 0), sorted.length - limit);
    end = start + limit;
  }

  const windowed = sorted.slice(start, end);
  const centerIndex = anchorIndex - start;

  const tiles: RailTile[] = windowed.map((match) => {
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
      match: { date: match.date, timeTbd: match.timeTbd, timezone: match.timezone },
      live: match.status === "live",
      // Null leaves the tile to render the kickoff in the reader's own zone.
      status:
        match.status === "live"
          ? match.minute
            ? `${match.minute}'`
            : "Live"
          : match.status === "final"
            ? "Full time"
            : match.status === "postponed"
              ? "PPD"
              : null,
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

  return { tiles, centerIndex };
}
