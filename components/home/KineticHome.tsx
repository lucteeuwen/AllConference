import Link from "next/link";
import { Odometer } from "@/components/home/Odometer";
import { Reveal } from "@/components/home/Reveal";
import { ScoreTicker } from "@/components/home/ScoreTicker";
import { Logo } from "@/components/Logo";
import { TeamBadge } from "@/components/TeamBadge";
import { formatKickoff, formatShortDate } from "@/lib/format";
import { played, requireTeam, resultFor } from "@/lib/selectors";
import type { HomeData } from "@/lib/home";
import type { Result } from "@/lib/types";

/**
 * Design 5 — Kinetic Scoreboard. The most motion-forward: a running ticker of
 * every score, odometer digits that roll into place, a sweeping clock ring, and
 * giant ghosted team abbreviations behind the featured match.
 */

const resultChip: Record<Result, string> = {
  W: "bg-win text-white",
  L: "bg-loss text-white",
  D: "bg-draw text-white",
};

const RING_RADIUS = 34;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function KineticHome({ data }: { data: HomeData }) {
  const featured = data.featured;
  const home = featured ? requireTeam(featured.home.teamSlug) : null;
  const away = featured ? requireTeam(featured.away.teamSlug) : null;
  const live = featured?.status === "live";

  // 90 minutes is the full sweep; a finished match shows a complete ring.
  const progress = live ? Math.min(1, (featured?.minute ?? 0) / 90) : 1;
  const ringOffset = RING_CIRCUMFERENCE * (1 - progress);

  // Today's finished games appear in `recent` too, so dedupe before slicing.
  const seen = new Set<string>();
  const tickerItems = [...data.recent, ...data.today]
    .filter((match) => !seen.has(match.id) && seen.add(match.id))
    .slice(0, 10);

  return (
    <div className="space-y-8 pt-5">
      <div className="-mx-4 flex items-stretch overflow-hidden border-y border-line bg-navy md:mx-0 md:rounded-full md:border">
        <span className="flex shrink-0 items-center gap-2 bg-brand px-4 py-2.5">
          <Logo className="h-4 w-auto text-white" gap="var(--brand)" title="AllConference" />
          <span className="hidden text-[10px] font-black tracking-[0.14em] text-white uppercase sm:inline">
            Live
          </span>
        </span>
        <div className="min-w-0 flex-1 self-center py-2.5">
        <ScoreTicker>
          {tickerItems.map((match) => {
            const tickerHome = requireTeam(match.home.teamSlug);
            const tickerAway = requireTeam(match.away.teamSlug);
            const decided = match.home.score !== null && match.away.score !== null;
            return (
              <span key={match.id} className="flex items-center gap-2 px-5 whitespace-nowrap">
                <span className="text-[12px] font-black text-white">{tickerHome.abbr}</span>
                <span className="text-[12px] font-black text-white/90 tabular-nums">
                  {decided ? `${match.home.score}-${match.away.score}` : formatKickoff(match.date)}
                </span>
                <span className="text-[12px] font-black text-white">{tickerAway.abbr}</span>
                <span className="ml-1 size-1 rounded-full bg-white/30" />
              </span>
            );
          })}
        </ScoreTicker>
        </div>
      </div>

      {featured && home && away ? (
        <section className="relative overflow-hidden rounded-card border border-line bg-surface">
          {/* Oversized ghosted abbreviations, the badminton reference's device. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-6 -left-4 text-[120px] leading-none font-black tracking-tighter text-ink opacity-[0.05] select-none md:text-[190px]"
          >
            {home.abbr}
          </span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-4 -bottom-10 text-[120px] leading-none font-black tracking-tighter text-ink opacity-[0.05] select-none md:text-[190px]"
          >
            {away.abbr}
          </span>

          <div className="relative p-6 md:p-8">
            <p className="mb-6 text-[10px] font-black tracking-[0.2em] text-ink-faint uppercase">
              {live ? "In progress" : "Next up"} · {formatShortDate(featured.date)}
            </p>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              <div className="flex flex-col items-center gap-3">
                <TeamBadge team={home} size="xl" />
                <span className="text-center text-[13px] font-black tracking-tight text-ink uppercase">
                  {home.name}
                </span>
              </div>

              <div className="relative flex size-[104px] items-center justify-center md:size-[124px]">
                <svg viewBox="0 0 80 80" className="absolute inset-0 size-full -rotate-90">
                  <circle cx="40" cy="40" r={RING_RADIUS} fill="none" stroke="var(--line)" strokeWidth="4" />
                  <circle
                    cx="40"
                    cy="40"
                    r={RING_RADIUS}
                    fill="none"
                    stroke={live ? "var(--live)" : "var(--accent)"}
                    strokeWidth="4"
                    strokeLinecap="round"
                    className="ring-sweep"
                    style={
                      {
                        strokeDasharray: RING_CIRCUMFERENCE,
                        strokeDashoffset: ringOffset,
                        "--ring-circumference": `${RING_CIRCUMFERENCE}`,
                        "--ring-offset": `${ringOffset}`,
                      } as React.CSSProperties
                    }
                  />
                </svg>
                <div className="relative text-center">
                  {featured.home.score !== null && featured.away.score !== null ? (
                    <div className="flex items-center justify-center text-3xl font-black text-ink md:text-4xl">
                      <Odometer value={featured.home.score} />
                      <span className="mx-0.5 text-ink-faint">-</span>
                      <Odometer value={featured.away.score} />
                    </div>
                  ) : (
                    <div className="text-[15px] font-black text-ink tabular-nums">
                      {formatKickoff(featured.date)}
                    </div>
                  )}
                  <p className="mt-0.5 text-[10px] font-bold text-ink-faint tabular-nums">
                    {live ? `${featured.minute}'` : featured.status === "final" ? "FT" : "KO"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-3">
                <TeamBadge team={away} size="xl" />
                <span className="text-center text-[13px] font-black tracking-tight text-ink uppercase">
                  {away.name}
                </span>
              </div>
            </div>

            <Link
              href={`/matches/${featured.id}`}
              className="mt-7 block rounded-full bg-accent py-3 text-center text-[13px] font-black tracking-wide text-white uppercase transition hover:bg-accent-hover"
            >
              Match centre
            </Link>
          </div>
        </section>
      ) : null}

      <Reveal>
        <section>
          <h2 className="mb-3 px-1 text-[13px] font-black tracking-[0.16em] text-ink uppercase">
            Form guide
          </h2>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {data.standings.slice(0, 6).map((line) => (
              <Link
                key={line.team.slug}
                href={`/teams/${line.team.slug}`}
                className="rounded-card border border-line bg-surface p-4 transition hover:border-accent/50"
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="text-2xl font-black tracking-tighter text-ink-faint/40 tabular-nums">
                    {line.rank}
                  </span>
                  <TeamBadge team={line.team} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-black tracking-tight text-ink uppercase">
                    {line.team.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {line.row.form.length > 0 ? (
                    line.row.form.map((result, index) => (
                      <span
                        key={index}
                        className={`flex size-6 items-center justify-center rounded-md text-[11px] font-black ${resultChip[result]}`}
                      >
                        {result}
                      </span>
                    ))
                  ) : (
                    <span className="text-[12px] text-ink-faint">No results yet</span>
                  )}
                  <span className="ml-auto text-[12px] font-black text-ink tabular-nums">
                    {line.row.conference.pts}
                    <span className="ml-1 text-[10px] font-bold text-ink-faint">
                      / {played(line.row.conference)} GP
                    </span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal delay={80}>
        <section>
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-[13px] font-black tracking-[0.16em] text-ink uppercase">
              Latest results
            </h2>
            <Link href="/matches?status=results" className="text-[12px] font-bold text-accent hover:underline">
              See all
            </Link>
          </div>
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            {data.recent.slice(0, 5).map((match) => {
              const rowHome = requireTeam(match.home.teamSlug);
              const rowAway = requireTeam(match.away.teamSlug);
              const homeResult = resultFor(match, rowHome.slug);
              return (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 transition hover:bg-ground"
                >
                  {homeResult ? (
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-black ${resultChip[homeResult]}`}
                    >
                      {homeResult}
                    </span>
                  ) : null}
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <TeamBadge team={rowHome} size="xs" />
                    <span className="truncate text-[13px] font-bold text-ink">{rowHome.name}</span>
                  </span>
                  <span className="shrink-0 text-[15px] font-black text-ink tabular-nums">
                    {match.home.score}-{match.away.score}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
                    <span className="truncate text-right text-[13px] font-bold text-ink">
                      {rowAway.name}
                    </span>
                    <TeamBadge team={rowAway} size="xs" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </Reveal>
    </div>
  );
}
