import Link from "next/link";
import { TeamBadge } from "@/components/TeamBadge";
import { requireTeam } from "@/lib/selectors";
import type { Match } from "@/lib/types";

/** The hero panel at the top of the matches page while a game is in progress. */
export function LiveMatchCard({ match }: { match: Match }) {
  const home = requireTeam(match.home.teamSlug);
  const away = requireTeam(match.away.teamSlug);

  return (
    <div className="overflow-hidden rounded-card bg-gradient-to-b from-accent to-[#3323a0] shadow-[0_18px_40px_-24px_rgba(67,56,202,0.9)]">
      <div className="flex items-center justify-center gap-2 border-b border-white/15 py-2 text-[11px] font-bold tracking-[0.14em] text-white uppercase">
        <span className="live-dot size-1.5 rounded-full bg-white" />
        Live Now
      </div>

      <div className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="truncate text-sm font-bold text-white">
            {home.name} vs {away.name}
          </p>
          <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold tabular-nums text-white">
            {match.minute}&apos;
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex flex-col items-center gap-2">
            <TeamBadge team={home} size="lg" ring />
            <span className="text-center text-[13px] font-semibold text-white">{home.name}</span>
          </div>

          <div className="text-center">
            <div className="text-4xl font-black tabular-nums text-white">
              {match.home.score} <span className="text-white/40">-</span> {match.away.score}
            </div>
            <p className="mt-1 text-[11px] font-medium text-white/70">
              {(match.minute ?? 0) <= 45 ? "1st Half" : "2nd Half"}
            </p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <TeamBadge team={away} size="lg" ring />
            <span className="text-center text-[13px] font-semibold text-white">{away.name}</span>
          </div>
        </div>

        <Link
          href={`/matches/${match.id}`}
          className="mt-5 block rounded-xl bg-white py-3 text-center text-sm font-bold text-accent transition hover:bg-white/90"
        >
          Match Centre
        </Link>
      </div>
    </div>
  );
}
