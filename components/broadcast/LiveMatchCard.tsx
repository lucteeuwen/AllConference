import Link from "next/link";
import { WashHero } from "@/components/broadcast/WashHero";
import { OverlapCard } from "@/components/broadcast/OverlapCard";
import { Boxscore } from "@/components/broadcast/Boxscore";
import { Collapsible } from "@/components/broadcast/Collapsible";
import { HeroScore, HeroStatus, HeroWindow } from "@/components/broadcast/HeroClock";
import { LocalTime } from "@/components/LocalTime";
import { TeamBadge } from "@/components/TeamBadge";
import { timingOf } from "@/lib/hero";
import { effectiveStatus } from "@/lib/live";
import { competitionLabel, type StandingsLine } from "@/lib/selectors";
import { matchHref } from "@/lib/sport";
import type { Match } from "@/lib/types";

/**
 * One match's box on the home page: the score hero with the boxscore lapping
 * over it. Several can sit side by side; `featured` marks the one to look at
 * first, and `compact` shrinks the crests so two fit across.
 */
export function LiveMatchCard({
  match,
  standings,
  renderedAt,
  featured = false,
  compact = false,
}: {
  match: Match;
  standings: StandingsLine[];
  renderedAt: number;
  featured?: boolean;
  compact?: boolean;
}) {
  const timing = timingOf(match);
  const live = effectiveStatus(timing, renderedAt).status === "live";
  const hasScore = match.home.score !== null && match.away.score !== null;
  const badge = compact ? "md" : "lg";

  return (
    <HeroWindow timing={timing} renderedAt={renderedAt}>
      <section className="min-w-0">
        <WashHero home={match.home.team} away={match.away.team} celebrate={live ? match.id : false} highlight={featured}>
          <p className="bc-label text-[0.8rem] text-white/70 md:text-[0.92rem]">
            {match.home.team.name} <span className="text-white/35">@</span> {match.away.team.name}
          </p>

          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="slide-from-left flex min-w-0 flex-col items-center gap-2">
              <TeamBadge team={match.home.team} size={badge} ring />
              <span className="text-center text-[0.75rem] font-semibold break-words text-white">{match.home.team.name}</span>
            </div>

            <div className="relative">
              <HeroStatus timing={timing} renderedAt={renderedAt} />

              <HeroScore
                timing={timing}
                homeScore={match.home.score}
                awayScore={match.away.score}
                renderedAt={renderedAt}
              />

              <p className="bc-label mt-1.5 text-[0.64rem] text-white/55">
                <LocalTime match={match} format="shortTime" /> · {competitionLabel(match)}
              </p>
            </div>

            <div className="slide-from-right flex min-w-0 flex-col items-center gap-2">
              <TeamBadge team={match.away.team} size={badge} ring />
              <span className="text-center text-[0.75rem] font-semibold break-words text-white">{match.away.team.name}</span>
            </div>
          </div>

          <Link
            href={matchHref(match.id)}
            className="bc-cta bc-label mt-6 inline-flex rounded-control border border-white/25 px-5 py-2 text-[0.72rem] text-white transition hover:bg-white hover:text-navy"
          >
            View match
          </Link>
        </WashHero>

        {hasScore ? (
          <OverlapCard>
            <Collapsible title="Boxscore" storageKey="boxscore-open">
              <Boxscore match={match} standings={standings} showHeading={false} />
            </Collapsible>
          </OverlapCard>
        ) : null}
      </section>
    </HeroWindow>
  );
}
