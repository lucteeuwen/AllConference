import Link from "next/link";
import { TeamBadge } from "@/components/TeamBadge";
import { formatKickoff } from "@/lib/format";
import { requireTeam } from "@/lib/selectors";
import type { Match } from "@/lib/types";

export function StatusPill({ match }: { match: Match }) {
  if (match.status === "live") {
    return (
      <span className="bc-label flex items-center gap-1.5 rounded-control bg-live/10 px-2.5 py-1 text-[0.68rem] text-live">
        <span className="live-dot size-1.5 rounded-full bg-live" />
        Live {match.minute}&apos;
      </span>
    );
  }
  if (match.status === "final") {
    return (
      <span className="bc-label rounded-control bg-ground px-2.5 py-1 text-[0.68rem] text-ink-muted">
        Final
      </span>
    );
  }
  if (match.status === "postponed") {
    return (
      <span className="bc-label rounded-control bg-amber-100 px-2.5 py-1 text-[0.68rem] text-amber-700">
        Postponed
      </span>
    );
  }
  return (
    <span className="bc-label rounded-control bg-accent-soft px-2.5 py-1 text-[0.68rem] text-accent">
      {formatKickoff(match.date)}
    </span>
  );
}

/** The list row used wherever matches are listed. */
export function MatchRow({ match }: { match: Match }) {
  const home = requireTeam(match.home.teamSlug);
  const away = requireTeam(match.away.teamSlug);
  const decided = match.status === "final";
  const homeWon = decided && (match.home.score ?? 0) > (match.away.score ?? 0);
  const awayWon = decided && (match.away.score ?? 0) > (match.home.score ?? 0);
  const hasScore = match.home.score !== null && match.away.score !== null;

  return (
    <Link
      href={`/matches/${match.id}`}
      className="bc-card bc-pad bc-shadow block transition hover:border-accent/40"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="bc-label truncate text-[0.68rem] text-ink-faint">
          {match.isConference ? "CCIW" : "Non-conference"} · {match.venue}
        </span>
        <StatusPill match={match} />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <TeamBadge team={home} size="sm" />
          <span
            className={`truncate text-[0.82rem] font-semibold ${awayWon ? "text-ink-muted" : "text-ink"}`}
          >
            {home.name}
          </span>
        </span>

        <span className="text-center">
          {hasScore ? (
            <span className="text-[1.3rem] font-black text-ink tabular-nums">
              <span className={awayWon ? "text-ink-faint" : ""}>{match.home.score}</span>
              <span className="mx-1.5 text-ink-faint">&ndash;</span>
              <span className={homeWon ? "text-ink-faint" : ""}>{match.away.score}</span>
            </span>
          ) : (
            <span className="text-[0.82rem] font-bold text-ink-muted">
              {match.status === "postponed" ? "PPD" : formatKickoff(match.date)}
            </span>
          )}
        </span>

        <span className="flex min-w-0 items-center justify-end gap-2.5">
          <span
            className={`truncate text-right text-[0.82rem] font-semibold ${
              homeWon ? "text-ink-muted" : "text-ink"
            }`}
          >
            {away.name}
          </span>
          <TeamBadge team={away} size="sm" />
        </span>
      </div>
    </Link>
  );
}
