import Link from "next/link";
import { TeamBadge } from "@/components/TeamBadge";
import { formatKickoff } from "@/lib/format";
import { competitionLabel } from "@/lib/selectors";
import type { Match, MatchSide } from "@/lib/types";

export function StatusPill({ match }: { match: Match }) {
  if (match.status === "live") {
    return (
      <span className="bc-label flex items-center gap-1.5 rounded-control bg-live/10 px-2.5 py-1 text-[0.68rem] text-live">
        <span className="live-dot size-1.5 rounded-full bg-live" />
        {match.minute ? <>Live {match.minute}&apos;</> : "Live"}
      </span>
    );
  }
  if (match.status === "final") {
    return (
      <span className="bc-label rounded-control bg-ground px-2.5 py-1 text-[0.68rem] text-ink-muted">
        Full time
      </span>
    );
  }
  if (match.status === "postponed" || match.status === "canceled") {
    return (
      <span className="bc-label rounded-control bg-amber-100 px-2.5 py-1 text-[0.68rem] text-amber-700">
        {match.status === "postponed" ? "Postponed" : "Canceled"}
      </span>
    );
  }
  return (
    <span className="bc-label rounded-control bg-accent-soft px-2.5 py-1 text-[0.68rem] text-accent">
      {formatKickoff(match.date)}
    </span>
  );
}

/** Team name, or what a TBC side is waiting on. */
export function sideName(side: MatchSide): string {
  return side.teamSlug ? side.team.name : (side.placeholder ?? "TBC");
}

/** Who won, counting a shootout for a level score. */
export function winnerOf(match: Match): "home" | "away" | null {
  if (match.status !== "final" || match.home.score === null || match.away.score === null) return null;
  if (match.home.score !== match.away.score) return match.home.score > match.away.score ? "home" : "away";
  const home = match.home.pens ?? null;
  const away = match.away.pens ?? null;
  if (home === null || away === null || home === away) return null;
  return home > away ? "home" : "away";
}

/** The list row used wherever matches are listed. */
export function MatchRow({ match }: { match: Match }) {
  const winner = winnerOf(match);
  const homeWon = winner === "home";
  const awayWon = winner === "away";
  const hasScore = match.home.score !== null && match.away.score !== null;
  const shootout = hasScore && match.home.pens != null && match.away.pens != null;

  return (
    <Link
      href={`/matches/${match.id}`}
      className="bc-card bc-pad bc-shadow block transition hover:border-accent/40"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="bc-label truncate text-[0.68rem] text-ink-faint">
          {competitionLabel(match)}
          {match.venue ? ` · ${match.venue}` : ""}
        </span>
        <StatusPill match={match} />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <TeamBadge team={match.home.team} size="sm" />
          <span
            className={`truncate text-[0.82rem] font-semibold ${
              awayWon || !match.home.teamSlug ? "text-ink-muted" : "text-ink"
            }`}
          >
            {sideName(match.home)}
          </span>
        </span>

        <span className="text-center">
          {hasScore ? (
            <span className="text-[1.3rem] font-black text-ink tabular-nums">
              <span className={awayWon ? "text-ink-faint" : ""}>{match.home.score}</span>
              <span className="mx-1.5 text-ink-faint">&ndash;</span>
              <span className={homeWon ? "text-ink-faint" : ""}>{match.away.score}</span>
              {shootout ? (
                <span className="block text-[0.62rem] font-bold text-ink-faint">
                  ({match.home.pens}&ndash;{match.away.pens} pens)
                </span>
              ) : null}
            </span>
          ) : (
            <span className="text-[0.82rem] font-bold text-ink-muted">
              {match.status === "postponed"
                ? "PPD"
                : match.status === "canceled"
                  ? "—"
                  : formatKickoff(match.date)}
            </span>
          )}
        </span>

        <span className="flex min-w-0 items-center justify-end gap-2.5">
          <span
            className={`truncate text-right text-[0.82rem] font-semibold ${
              homeWon || !match.away.teamSlug ? "text-ink-muted" : "text-ink"
            }`}
          >
            {sideName(match.away)}
          </span>
          <TeamBadge team={match.away.team} size="sm" />
        </span>
      </div>
    </Link>
  );
}
