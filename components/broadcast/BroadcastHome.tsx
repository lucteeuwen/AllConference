import Link from "next/link";
import { Lockup, SectionHeader } from "@/components/broadcast/Lockup";
import { WashHero } from "@/components/broadcast/WashHero";
import { OverlapCard } from "@/components/broadcast/OverlapCard";
import { Boxscore } from "@/components/broadcast/Boxscore";
import { Collapsible } from "@/components/broadcast/Collapsible";
import { AutoRefresh, HeroStatus, HeroWindow } from "@/components/broadcast/HeroClock";
import { ScoreboardRail } from "@/components/broadcast/ScoreboardRail";
import { ScorersSnippet, StandingsSnippet } from "@/components/broadcast/StandingsSnippet";
import { Reveal } from "@/components/broadcast/Reveal";
import { LocalTime } from "@/components/LocalTime";
import { TeamBadge } from "@/components/TeamBadge";
import { buildRailTiles } from "@/lib/rail";
import { timingOf } from "@/lib/hero";
import { competitionLabel, tableView } from "@/lib/selectors";
import type { HomeData } from "@/lib/home";

export function BroadcastHome({ data }: { data: HomeData }) {
  const table = tableView(data.standings);

  // 13 tiles: the six matches before the next one, the next one, and six after.
  const { tiles, centerIndex } = buildRailTiles(data.matches, data.standings, 13, data.renderedAt);

  // Only present around a match: 15 minutes either side of it.
  const hero = data.hero;
  const live = hero?.status === "live";
  const hasScore = hero ? hero.home.score !== null && hero.away.score !== null : false;

  return (
    <div className="bc-stack pb-2">
      <AutoRefresh />
      <Lockup
        title="CCIW Men's Soccer"
        subtitle="Live scores, results and standings"
        aside={
          <span className="bc-label rounded-control bg-white/10 px-3 py-1.5 text-[0.66rem] text-white/80">
            NCAA DIII
          </span>
        }
      />

      {hero ? (
        <HeroWindow timing={timingOf(hero)} renderedAt={data.renderedAt}>
          <section>
            <WashHero home={hero.home.team} away={hero.away.team} celebrate={live ? hero.id : false}>
              <p className="bc-label text-[0.8rem] text-white/70 md:text-[0.92rem]">
                {hero.home.team.name} <span className="text-white/35">@</span> {hero.away.team.name}
              </p>

              <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="slide-from-left flex flex-col items-center gap-2">
                  <TeamBadge team={hero.home.team} size="lg" ring />
                  <span className="text-[0.75rem] font-semibold text-white">{hero.home.team.name}</span>
                </div>

                <div className="relative">
                  <HeroStatus timing={timingOf(hero)} minute={hero.minute} renderedAt={data.renderedAt} />

                  {hasScore ? (
                    <>
                      {live ? (
                        <span
                          aria-hidden="true"
                          className="score-bloom pointer-events-none absolute inset-0 flex items-center justify-center text-5xl font-black text-white"
                        >
                          {hero.away.score}
                        </span>
                      ) : null}
                      <div className="rise-in text-[2.4rem] font-black text-white tabular-nums md:text-[3rem]">
                        {hero.home.score}
                        <span className="mx-2 text-white/30">-</span>
                        {hero.away.score}
                      </div>
                    </>
                  ) : (
                    <div className="text-2xl font-black text-white md:text-3xl">VS</div>
                  )}

                  <p className="bc-label mt-1.5 text-[0.64rem] text-white/55">
                    <LocalTime match={hero} format="shortTime" /> · {competitionLabel(hero)}
                  </p>
                </div>

                <div className="slide-from-right flex flex-col items-center gap-2">
                  <TeamBadge team={hero.away.team} size="lg" ring />
                  <span className="text-[0.75rem] font-semibold text-white">{hero.away.team.name}</span>
                </div>
              </div>

              <Link
                href={`/matches/${hero.id}`}
                className="bc-label mt-6 inline-flex rounded-control border border-white/25 px-5 py-2 text-[0.72rem] text-white transition hover:bg-white hover:text-navy"
              >
                View match
              </Link>
            </WashHero>

            {hasScore ? (
              <OverlapCard>
                <Collapsible title="Boxscore" storageKey="boxscore-open">
                  <Boxscore match={hero} standings={data.standings} showHeading={false} />
                </Collapsible>
              </OverlapCard>
            ) : null}
          </section>
        </HeroWindow>
      ) : null}

      {tiles.length > 0 ? (
        <div className="bc-rail">
          <ScoreboardRail tiles={tiles} centerIndex={centerIndex} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Reveal>
          <section>
            <SectionHeader title="Standings" action="Full standings" href="/standings" />
            <StandingsSnippet standings={table.lines} conferenceStarted={table.started} />
          </section>
        </Reveal>

        <Reveal delay={90}>
          <section>
            <SectionHeader title="Scoring leaders" action="Full list" href="/standings#scoring-leaders" />
            <ScorersSnippet scorers={data.scorers} />
          </section>
        </Reveal>
      </div>

      <Reveal>
        <section>
          <SectionHeader title="Coming up" action="All Matches" href="/matches" />
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {data.upcoming.map((match) => {
              const matchHome = match.home.team;
              const matchAway = match.away.team;
              return (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
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
