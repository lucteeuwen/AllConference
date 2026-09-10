import Link from "next/link";
import { TeamBadge } from "@/components/TeamBadge";
import { formatKickoff } from "@/lib/format";
import { requireTeam } from "@/lib/selectors";
import type { Match } from "@/lib/types";

function StatusPill({ match }: { match: Match }) {
  if (match.status === "live") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-live/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-live uppercase">
        <span className="live-dot size-1.5 rounded-full bg-live" />
        Live {match.minute}&apos;
      </span>
    );
  }
  if (match.status === "final") {
    return (
      <span className="rounded-full bg-ground px-2.5 py-1 text-[11px] font-bold tracking-wide text-ink-muted uppercase">
        Final
      </span>
    );
  }
  if (match.status === "postponed") {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold tracking-wide text-amber-700 uppercase">
        Postponed
      </span>
    );
  }
  return (
    <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold tracking-wide text-accent uppercase">
      {formatKickoff(match.date)}
    </span>
  );
}

export function MatchCard({ match }: { match: Match }) {
  const home = requireTeam(match.home.teamSlug);
  const away = requireTeam(match.away.teamSlug);
  const decided = match.status === "final";
  const homeWon = decided && (match.home.score ?? 0) > (match.away.score ?? 0);
  const awayWon = decided && (match.away.score ?? 0) > (match.home.score ?? 0);

  const nameClass = (won: boolean, lost: boolean) =>
    `truncate text-sm font-semibold ${
      lost ? "text-ink-muted" : won ? "text-ink" : "text-ink"
    }`;

  return (
    <Link
      href={`/matches/${match.id}`}
      className="block rounded-card border border-line bg-surface px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-accent/40 hover:shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_28px_-18px_rgba(67,56,202,0.55)]"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
          {match.isConference ? "CCIW" : "Non-conference"} · {match.venue}
        </span>
        <StatusPill match={match} />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <TeamBadge team={home} size="sm" />
          <span className={nameClass(homeWon, awayWon)}>{home.name}</span>
        </div>

        <div className="text-center">
          {match.home.score !== null && match.away.score !== null ? (
            <span className="text-xl font-black tabular-nums text-ink">
              <span className={awayWon ? "text-ink-faint" : ""}>{match.home.score}</span>
              <span className="mx-1.5 text-ink-faint">&ndash;</span>
              <span className={homeWon ? "text-ink-faint" : ""}>{match.away.score}</span>
            </span>
          ) : (
            <span className="text-[13px] font-bold text-ink-muted">
              {match.status === "postponed" ? "PPD" : formatKickoff(match.date)}
            </span>
          )}
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2.5">
          <span className={`${nameClass(awayWon, homeWon)} text-right`}>{away.name}</span>
          <TeamBadge team={away} size="sm" />
        </div>
      </div>

      {match.status === "scheduled" ? (
        <div className="mt-3 flex justify-center">
          <span className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-[11px] font-semibold text-ink-muted">
            <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6z" strokeLinejoin="round" />
              <path d="M10 20a2.2 2.2 0 004 0" strokeLinecap="round" />
            </svg>
            Reminder
          </span>
        </div>
      ) : null}
    </Link>
  );
}
