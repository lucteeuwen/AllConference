import Link from "next/link";
import { TeamBadge } from "@/components/TeamBadge";
import { DateLead, RowCentre, StatusPill } from "@/components/broadcast/LiveMatch";
import { competitionLabel } from "@/lib/selectors";
import type { Match, MatchSide } from "@/lib/types";

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

/**
 * The list row used wherever matches are listed. `showDate` is for lists with
 * no day headings: upcoming rows put the date in the pill, every other row
 * keeps its status pill and leads the label with the date instead.
 */
export function MatchRow({
  match,
  renderedAt,
  showDate = false,
}: {
  match: Match;
  /** The server's clock, so the clock-driven parts hydrate to what the HTML says. */
  renderedAt: number;
  showDate?: boolean;
}) {
  const winner = winnerOf(match);
  const homeWon = winner === "home";
  const awayWon = winner === "away";

  return (
    <Link
      href={`/matches/${match.id}`}
      className="bc-card bc-pad bc-shadow block transition hover:border-accent/40"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="bc-label truncate text-[0.68rem] text-ink-faint">
          {showDate ? <DateLead match={match} renderedAt={renderedAt} /> : null}
          {competitionLabel(match)}
          {match.venue ? ` · ${match.venue}` : ""}
        </span>
        <StatusPill match={match} renderedAt={renderedAt} showDate={showDate} />
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
          <RowCentre match={match} renderedAt={renderedAt} homeWon={homeWon} awayWon={awayWon} />
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
