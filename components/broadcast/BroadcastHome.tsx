import Link from "next/link";
import { Lockup, SectionHeader } from "@/components/broadcast/Lockup";
import { LiveMatchCard } from "@/components/broadcast/LiveMatchCard";
import { LiveRefresh } from "@/components/LiveRefresh";
import { ScoreboardRail } from "@/components/broadcast/ScoreboardRail";
import { ScorersSnippet, StandingsSnippet } from "@/components/broadcast/StandingsSnippet";
import { Reveal } from "@/components/broadcast/Reveal";
import { LocalTime } from "@/components/LocalTime";
import { TeamBadge } from "@/components/TeamBadge";
import { buildRailTiles } from "@/lib/rail";
import { timingOf } from "@/lib/hero";
import { tableView } from "@/lib/selectors";
import type { HomeData } from "@/lib/home";
import { matchHref, SPORT_LABEL, sportHref } from "@/lib/sport";

export function BroadcastHome({ data }: { data: HomeData }) {
  const table = tableView(data.standings);

  // 13 tiles: the six matches before the next one, the next one, and six after.
  const { tiles, centerIndex } = buildRailTiles(data.matches, data.standings, 13, data.renderedAt);

  return (
    <div className="bc-stack pb-2">
      <LiveRefresh timings={data.matches.map(timingOf)} renderedAt={data.renderedAt} idleMs={60_000} />
      <Lockup
        title={`CCIW ${SPORT_LABEL[data.sport]}`}
        subtitle="Live scores, results and standings"
        aside={
          <span className="bc-label max-md:hidden rounded-control bg-white/10 px-3 py-1.5 text-[0.66rem] text-white/80">
            NCAA DIII
          </span>
        }
      />

      {data.heroes.length > 0 ? (
        <div className={data.heroes.length > 1 ? "grid items-start gap-6 md:grid-cols-2" : undefined}>
          {data.heroes.map((match, index) => (
            <LiveMatchCard
              key={match.id}
              match={match}
              standings={data.standings}
              renderedAt={data.renderedAt}
              featured={data.heroes.length > 1 && index === 0}
              compact={data.heroes.length > 1}
            />
          ))}
        </div>
      ) : null}

      {tiles.length > 0 ? (
        <div className="bc-rail">
          <ScoreboardRail tiles={tiles} centerIndex={centerIndex} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Reveal>
          <section>
            <SectionHeader title="Standings" action="Full standings" href={sportHref(data.sport, "/standings")} />
            <StandingsSnippet sport={data.sport} standings={table.lines} conferenceStarted={table.started} />
          </section>
        </Reveal>

        <Reveal delay={90}>
          <section>
            <SectionHeader title="Scoring leaders" action="Full list" href={sportHref(data.sport, "/standings#scoring-leaders")} />
            <ScorersSnippet scorers={data.scorers} />
          </section>
        </Reveal>
      </div>

      <Reveal>
        <section>
          <SectionHeader title="Coming up" action="All Matches" href={sportHref(data.sport, "/matches")} />
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {data.upcoming.map((match) => {
              const matchHome = match.home.team;
              const matchAway = match.away.team;
              return (
                <Link
                  key={match.id}
                  href={matchHref(match.id)}
                  className="bc-card bc-pad bc-shadow transition hover:border-accent/50"
                >
                  <p className="bc-label mb-2.5 flex items-center justify-between text-[0.65rem] text-ink-faint">
                    <span>
                      <LocalTime match={match} format="short" />
                    </span>
                    <span>
                      <LocalTime match={match} />
                    </span>
                  </p>
                  <div className="flex items-center gap-2">
                    <TeamBadge team={matchHome} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-[0.82rem] font-semibold text-ink">
                      {match.home.teamSlug ? matchHome.name : (match.home.placeholder ?? "TBC")}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <TeamBadge team={matchAway} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-[0.82rem] font-semibold text-ink">
                      {match.away.teamSlug ? matchAway.name : (match.away.placeholder ?? "TBC")}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </Reveal>
    </div>
  );
}
