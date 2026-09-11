import Link from "next/link";
import { MatchupHero } from "@/components/home/MatchupHero";
import { ScoreboardRail, type RailTile } from "@/components/home/ScoreboardRail";
import { Reveal } from "@/components/home/Reveal";
import { Logo } from "@/components/Logo";
import { TeamBadge } from "@/components/TeamBadge";
import { FormDots } from "@/components/FormDots";
import { formatKickoff, formatShortDate } from "@/lib/format";
import { played, requireTeam } from "@/lib/selectors";
import type { HomeData } from "@/lib/home";
import type { Match } from "@/lib/types";

/**
 * Design 1 — Broadcast. The reference video, most literally: a scoreboard rail
 * across the top, a split-colour matchup hero, and a surface card lapping over
 * the hero's bottom edge carrying the half-by-half detail.
 */

function toTile(match: Match, recordOf: (slug: string) => string): RailTile {
  const home = requireTeam(match.home.teamSlug);
  const away = requireTeam(match.away.teamSlug);
  const decided = match.status === "final" && match.home.score !== null && match.away.score !== null;

  return {
    id: match.id,
    live: match.status === "live",
    status:
      match.status === "live"
        ? `${match.minute}'`
        : match.status === "final"
          ? "Final"
          : match.status === "postponed"
            ? "PPD"
            : formatKickoff(match.date),
    note: match.isConference ? "CCIW" : "Non-conf",
    home: { team: home, score: match.home.score, record: recordOf(home.slug) },
    away: { team: away, score: match.away.score, record: recordOf(away.slug) },
    winner: !decided
      ? null
      : (match.home.score as number) > (match.away.score as number)
        ? "home"
        : (match.away.score as number) > (match.home.score as number)
          ? "away"
          : null,
  };
}

export function BroadcastHome({ data }: { data: HomeData }) {
  const records = new Map(
    data.standings.map((line) => [
      line.team.slug,
      `${line.row.overall.w}-${line.row.overall.l}-${line.row.overall.d}`,
    ]),
  );
  const recordOf = (slug: string) => records.get(slug) ?? "0-0-0";

  // Today's finished games also show up in `recent`, so dedupe before slicing.
  const seen = new Set<string>();
  const tiles = [...data.today, ...data.recent, ...data.upcoming]
    .filter((match) => !seen.has(match.id) && seen.add(match.id))
    .slice(0, 12)
    .map((match) => toTile(match, recordOf));

  const featured = data.featured;
  const home = featured ? requireTeam(featured.home.teamSlug) : null;
  const away = featured ? requireTeam(featured.away.teamSlug) : null;

  const halves = featured
    ? (["home", "away"] as const).map((side) => {
        const slug = featured[side].teamSlug;
        const goals = featured.events.filter(
          (event) => event.teamSlug === slug && (event.type === "goal" || event.type === "penalty"),
        );
        return {
          team: requireTeam(slug),
          first: goals.filter((event) => event.minute <= 45).length,
          second: goals.filter((event) => event.minute > 45).length,
          total: featured[side].score,
        };
      })
    : [];

  // Points share between the two featured sides, the honest stand-in for the
  // possession donut in the reference.
  const shareRows = halves.map(
    (half) => data.standings.find((line) => line.team.slug === half.team.slug)?.row.conference.pts ?? 0,
  );
  const shareTotal = shareRows.reduce((sum, value) => sum + value, 0) || 1;
  const homeShare = Math.round((shareRows[0] / shareTotal) * 100);

  return (
    <div className="space-y-8 pt-5">
      <header className="-mx-4 flex items-center gap-3 bg-navy px-4 py-3.5 md:mx-0 md:rounded-card md:px-5">
        <Logo className="h-7 w-auto text-white" gap="var(--navy)" title="AllConference" />
        <span className="h-6 w-px bg-white/20" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-black tracking-tight text-white">
            CCIW Men&apos;s Soccer
          </p>
          <p className="text-[11px] text-white/55">Live scores, results and standings</p>
        </div>
      </header>

      {tiles.length > 0 ? <ScoreboardRail tiles={tiles} /> : null}

      {featured && home && away ? (
        <section>
          <MatchupHero
            match={featured}
            home={home}
            away={away}
            kickoff={`${formatShortDate(featured.date)} · ${formatKickoff(featured.date)}`}
          />

          {/* Lapping over the hero's bottom edge, as in the reference. */}
          <div className="-mt-5 px-3 md:px-8">
            <div className="rounded-card border border-line bg-surface p-4 shadow-card md:p-5">
              <div className="grid gap-5 md:grid-cols-[1fr_auto] md:gap-8">
                <div>
                  <h3 className="mb-3 text-[11px] font-black tracking-[0.12em] text-ink-faint uppercase">
                    Boxscore
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] font-bold tracking-wide text-ink-faint uppercase">
                        <th scope="col" className="pb-1.5 text-left font-bold">Team</th>
                        <th scope="col" className="pb-1.5 px-3 text-center font-bold">1H</th>
                        <th scope="col" className="pb-1.5 px-3 text-center font-bold">2H</th>
                        <th scope="col" className="pb-1.5 pl-3 text-center font-bold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {halves.map((half) => (
                        <tr key={half.team.slug} className="border-t border-line">
                          <td className="py-2">
                            <span className="flex items-center gap-2">
                              <TeamBadge team={half.team} size="xs" />
                              <span className="truncate font-semibold text-ink">{half.team.name}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center tabular-nums text-ink-muted">
                            {half.total === null ? "–" : half.first}
                          </td>
                          <td className="px-3 py-2 text-center tabular-nums text-ink-muted">
                            {half.total === null ? "–" : half.second}
                          </td>
                          <td className="pl-3 py-2 text-center text-[15px] font-black tabular-nums text-ink">
                            {half.total ?? "–"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {halves.length === 2 ? (
                  <div className="flex items-center gap-4 border-t border-line pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-8">
                    <div className="relative size-20 shrink-0">
                      {/* Only the ring is lifted in dark mode; the punched-out
                          centre has to stay exactly the surface colour. */}
                      <span
                        className="team-color absolute inset-0 rounded-full"
                        style={{
                          background: `conic-gradient(${halves[0].team.primary} 0% ${homeShare}%, ${halves[1].team.primary} ${homeShare}% 100%)`,
                        }}
                      />
                      <span className="absolute inset-[9px] rounded-full bg-surface" />
                    </div>
                    <div className="text-[12px]">
                      <p className="mb-1 text-[10px] font-bold tracking-wide text-ink-faint uppercase">
                        CCIW points share
                      </p>
                      {halves.map((half, index) => (
                        <p key={half.team.slug} className="flex items-center gap-1.5 py-0.5">
                          <span
                            className="team-color size-2 rounded-full"
                            style={{ background: half.team.primary }}
                          />
                          <span className="font-semibold text-ink">{half.team.name}</span>
                          <span className="ml-auto pl-3 font-black tabular-nums text-ink">
                            {index === 0 ? homeShare : 100 - homeShare}%
                          </span>
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Reveal>
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[13px] font-black tracking-[0.12em] text-ink uppercase">
                Conference table
              </h2>
              <Link href="/standings" className="text-[12px] font-bold text-accent hover:underline">
                Full table
              </Link>
            </div>
            <div className="overflow-hidden rounded-card border border-line bg-surface">
              {data.standings.slice(0, 6).map((line) => (
                <Link
                  key={line.team.slug}
                  href={`/teams/${line.team.slug}`}
                  className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 transition hover:bg-ground"
                >
                  <span className="w-4 text-[12px] font-black tabular-nums text-ink-faint">
                    {line.rank}
                  </span>
                  <TeamBadge team={line.team} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">
                    {line.team.name}
                  </span>
                  <FormDots form={line.row.form} />
                  <span className="w-14 text-right text-[12px] tabular-nums text-ink-muted">
                    {played(line.row.conference)} GP
                  </span>
                  <span className="w-8 text-right text-[14px] font-black tabular-nums text-ink">
                    {line.row.conference.pts}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal delay={90}>
          <section>
            <h2 className="mb-3 text-[13px] font-black tracking-[0.12em] text-ink uppercase">
              Scoring leaders
            </h2>
            <div className="overflow-hidden rounded-card border border-line bg-surface">
              {data.scorers.map((line, index) => (
                <div
                  key={line.player.id}
                  className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0"
                >
                  <span className="w-4 text-[12px] font-black tabular-nums text-ink-faint">
                    {index + 1}
                  </span>
                  <TeamBadge team={line.team} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-ink">
                      {line.player.name}
                    </span>
                    <span className="block text-[11px] text-ink-faint">
                      {line.player.stats.goals}G · {line.player.stats.assists}A
                    </span>
                  </span>
                  <span className="text-[15px] font-black tabular-nums text-accent">
                    {line.points}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      </div>

      <Reveal>
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[13px] font-black tracking-[0.12em] text-ink uppercase">
              Coming up
            </h2>
            <Link href="/matches" className="text-[12px] font-bold text-accent hover:underline">
              All fixtures
            </Link>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {data.upcoming.map((match) => {
              const matchHome = requireTeam(match.home.teamSlug);
              const matchAway = requireTeam(match.away.teamSlug);
              return (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="rounded-card border border-line bg-surface p-3.5 transition hover:border-accent/50 hover:shadow-lift"
                >
                  <p className="mb-2.5 flex items-center justify-between text-[10px] font-bold tracking-wide text-ink-faint uppercase">
                    <span>{formatShortDate(match.date)}</span>
                    <span>{formatKickoff(match.date)}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <TeamBadge team={matchHome} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                      {matchHome.name}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <TeamBadge team={matchAway} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
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
