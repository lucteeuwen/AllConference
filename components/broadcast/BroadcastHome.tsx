import Link from "next/link";
import { Lockup, SectionHeader } from "@/components/broadcast/Lockup";
import { WashHero } from "@/components/broadcast/WashHero";
import { OverlapCard } from "@/components/broadcast/OverlapCard";
import { Boxscore } from "@/components/broadcast/Boxscore";
import { Collapsible } from "@/components/broadcast/Collapsible";
import { ScoreboardRail } from "@/components/broadcast/ScoreboardRail";
import { ScorersSnippet, StandingsSnippet } from "@/components/broadcast/StandingsSnippet";
import { Reveal } from "@/components/broadcast/Reveal";
import { TeamBadge } from "@/components/TeamBadge";
import { buildRailTiles } from "@/lib/rail";
import { formatKickoff, formatShortDate } from "@/lib/format";
import { requireTeam } from "@/lib/selectors";
import type { HomeData } from "@/lib/home";

export function BroadcastHome({ data }: { data: HomeData }) {
  const tiles = buildRailTiles([...data.today, ...data.recent, ...data.upcoming], data.standings, 12);

  const featured = data.featured;
  const home = featured ? requireTeam(featured.home.teamSlug) : null;
  const away = featured ? requireTeam(featured.away.teamSlug) : null;
  const live = featured?.status === "live";
  const hasScore = featured ? featured.home.score !== null && featured.away.score !== null : false;

  return (
    <div className="bc-stack pb-2">
      <Lockup
        title="CCIW Men's Soccer"
        subtitle="Live scores, results and standings"
        aside={
          <span className="bc-label rounded-control bg-white/10 px-3 py-1.5 text-[0.66rem] text-white/80">
            NCAA DIII
          </span>
        }
      />

      {featured && home && away ? (
        <section>
          <WashHero home={home} away={away} celebrate={live ? featured.id : false}>
            <p className="bc-label text-[0.8rem] text-white/70 md:text-[0.92rem]">
              {home.name} <span className="text-white/35">@</span> {away.name}
            </p>

            <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="slide-from-left flex flex-col items-center gap-2">
                <TeamBadge team={home} size="lg" ring />
                <span className="text-[0.75rem] font-semibold text-white">{home.name}</span>
              </div>

              <div className="relative">
                {live ? (
                  <span className="mb-2 inline-flex items-center gap-1.5 rounded-control bg-win px-3 py-1 text-[0.7rem] font-black text-white tabular-nums">
                    <span className="live-dot size-1.5 rounded-full bg-white" />
                    {featured.minute}&apos;
                  </span>
                ) : (
                  <span className="mb-2 inline-block rounded-control bg-white/15 px-3 py-1 text-[0.7rem] font-bold text-white/85">
                    {formatShortDate(featured.date)} · {formatKickoff(featured.date)}
                  </span>
                )}

                {hasScore ? (
                  <>
                    {live ? (
                      <span
                        aria-hidden="true"
                        className="score-bloom pointer-events-none absolute inset-0 flex items-center justify-center text-5xl font-black text-white"
                      >
                        {featured.away.score}
                      </span>
                    ) : null}
                    <div className="rise-in text-[2.4rem] font-black text-white tabular-nums md:text-[3rem]">
                      {featured.home.score}
                      <span className="mx-2 text-white/30">-</span>
                      {featured.away.score}
                    </div>
                  </>
                ) : (
                  <div className="text-2xl font-black text-white md:text-3xl">VS</div>
                )}

                <p className="bc-label mt-1.5 text-[0.64rem] text-white/55">
                  {featured.isConference ? "CCIW Conference" : "Non-conference"}
                </p>
              </div>

              <div className="slide-from-right flex flex-col items-center gap-2">
                <TeamBadge team={away} size="lg" ring />
                <span className="text-[0.75rem] font-semibold text-white">{away.name}</span>
              </div>
            </div>

            <Link
              href={`/matches/${featured.id}`}
              className="bc-label mt-6 inline-flex rounded-control border border-white/25 px-5 py-2 text-[0.72rem] text-white transition hover:bg-white hover:text-navy"
            >
              View match
            </Link>
          </WashHero>

          <OverlapCard>
            <Collapsible title="Boxscore" storageKey="boxscore-open">
              <Boxscore match={featured} standings={data.standings} showHeading={false} />
            </Collapsible>
          </OverlapCard>
        </section>
      ) : null}

      {tiles.length > 0 ? (
        <div className="bc-rail">
          <ScoreboardRail tiles={tiles} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Reveal>
          <section>
            <SectionHeader title="Conference table" action="Full table" href="/standings" />
            <StandingsSnippet standings={data.standings} />
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
          <SectionHeader title="Coming up" action="All fixtures" href="/matches" />
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {data.upcoming.map((match) => {
              const matchHome = requireTeam(match.home.teamSlug);
              const matchAway = requireTeam(match.away.teamSlug);
              return (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="bc-card bc-pad bc-shadow transition hover:border-accent/50"
                >
                  <p className="bc-label mb-2.5 flex items-center justify-between text-[0.65rem] text-ink-faint">
                    <span>{formatShortDate(match.date)}</span>
                    <span>{formatKickoff(match.date)}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <TeamBadge team={matchHome} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-[0.82rem] font-semibold text-ink">
                      {matchHome.name}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <TeamBadge team={matchAway} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-[0.82rem] font-semibold text-ink">
                      {matchAway.name}
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
