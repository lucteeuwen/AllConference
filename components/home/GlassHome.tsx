import Link from "next/link";
import { Reveal } from "@/components/home/Reveal";
import { LogoTile } from "@/components/Logo";
import { TeamBadge } from "@/components/TeamBadge";
import { formatKickoff, formatShortDate } from "@/lib/format";
import { tint } from "@/lib/color";
import { played, requireTeam } from "@/lib/selectors";
import type { HomeData } from "@/lib/home";
import type { Match } from "@/lib/types";

/**
 * Design 2 — Stadium Glass. The canvas is part of the design rather than the
 * page ground, so it draws its own backdrop and reads its colours from the
 * `--glass-*` tokens, which flip with the theme: frosted white over a pale sky
 * in light, translucent panes over deep navy in dark.
 */

const glass =
  "rounded-card border border-[var(--glass-edge)] bg-[var(--glass-fill)] shadow-[inset_0_1px_0_var(--glass-edge),0_16px_40px_-24px_rgba(4,16,31,0.45)] backdrop-blur-xl";

function GlassMatchRow({ match }: { match: Match }) {
  const home = requireTeam(match.home.teamSlug);
  const away = requireTeam(match.away.teamSlug);
  const decided = match.home.score !== null && match.away.score !== null;
  const live = match.status === "live";

  return (
    <Link
      href={`/matches/${match.id}`}
      className="flex items-center gap-3 border-b border-[var(--glass-rule)] px-4 py-3 transition last:border-0 hover:bg-[var(--glass-hover)]"
    >
      <span
        className={`w-14 shrink-0 text-[11px] font-bold tabular-nums ${
          live ? "text-live" : "text-[var(--glass-ink-faint)]"
        }`}
      >
        {match.status === "final" ? "FT" : live ? `${match.minute}'` : formatKickoff(match.date)}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <TeamBadge team={home} size="xs" />
        <span className="truncate text-[13px] font-semibold text-[var(--glass-ink)]">
          {home.name}
        </span>
      </span>
      <span className="shrink-0 rounded-lg bg-[var(--glass-chip)] px-2.5 py-1 text-[13px] font-black text-[var(--glass-ink)] tabular-nums">
        {decided ? `${match.home.score}–${match.away.score}` : "vs"}
      </span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <span className="truncate text-right text-[13px] font-semibold text-[var(--glass-ink)]">
          {away.name}
        </span>
        <TeamBadge team={away} size="xs" />
      </span>
    </Link>
  );
}

function PanelHeading({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-[var(--glass-rule)] px-4 py-3">
      <h2 className="text-[13px] font-black text-[var(--glass-ink)]">{title}</h2>
      <Link
        href={href}
        className="text-[11px] font-bold text-[var(--glass-ink-soft)] transition hover:text-[var(--glass-ink)]"
      >
        See all
      </Link>
    </div>
  );
}

export function GlassHome({ data }: { data: HomeData }) {
  const featured = data.featured;
  const home = featured ? requireTeam(featured.home.teamSlug) : null;
  const away = featured ? requireTeam(featured.away.teamSlug) : null;
  const live = featured?.status === "live";

  return (
    <div className="pt-5">
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10"
        style={{ background: "var(--glass-canvas)" }}
      />

      <div className="mb-6 flex items-center gap-3.5">
        <LogoTile className="size-12 shrink-0 shadow-[0_10px_30px_-12px_rgba(43,123,201,0.9)]" />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-[var(--glass-ink-soft)]">AllConference</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-[var(--glass-ink)] md:text-3xl">
            <span className="text-[var(--glass-ink-soft)]">Live scores from</span> the CCIW
          </h1>
        </div>
      </div>

      {featured && home && away ? (
        <section className={`relative mb-6 overflow-hidden p-5 ${glass}`}>
          {/* Two drifting washes, one per school, meeting in the middle. */}
          <span
            aria-hidden="true"
            className="glow-drift pointer-events-none absolute -top-1/2 -left-1/4 size-[130%] rounded-full blur-3xl"
            style={{ background: `radial-gradient(circle, ${tint(home.primary, 0.42)} 0%, transparent 62%)` }}
          />
          <span
            aria-hidden="true"
            className="glow-drift pointer-events-none absolute -right-1/4 -bottom-1/2 size-[130%] rounded-full blur-3xl"
            style={{
              background: `radial-gradient(circle, ${tint(away.primary, 0.42)} 0%, transparent 62%)`,
              animationDelay: "-7s",
            }}
          />

          <div className="relative">
            <div className="mb-5 flex items-center justify-between gap-3">
              <span className="rounded-full bg-[var(--glass-chip)] px-3 py-1 text-[10px] font-bold tracking-[0.1em] text-[var(--glass-ink-soft)] uppercase">
                {featured.isConference ? "CCIW Conference" : "Non-conference"}
              </span>
              {live ? (
                <span className="relative flex items-center gap-1.5 rounded-full bg-live px-3 py-1 text-[10px] font-black tracking-wide text-white uppercase">
                  <span aria-hidden="true" className="radio-wave absolute inset-0 rounded-full bg-live/50" />
                  <span className="live-dot relative size-1.5 rounded-full bg-white" />
                  <span className="relative">Live {featured.minute}&apos;</span>
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-[var(--glass-ink-soft)]">
                  {formatShortDate(featured.date)} · {formatKickoff(featured.date)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="flex flex-col items-center gap-2.5">
                <TeamBadge team={home} size="xl" ring />
                <span className="text-center text-[13px] font-bold text-[var(--glass-ink)]">
                  {home.name}
                </span>
              </div>
              <div className="text-center">
                {featured.home.score !== null && featured.away.score !== null ? (
                  <div className="text-5xl font-black text-[var(--glass-ink)] tabular-nums">
                    {featured.home.score}
                    <span className="mx-2 text-[var(--glass-ink-faint)]">:</span>
                    {featured.away.score}
                  </div>
                ) : (
                  <div className="text-3xl font-black text-[var(--glass-ink-soft)]">VS</div>
                )}
                <p className="mt-1 text-[11px] text-[var(--glass-ink-faint)]">{featured.venue}</p>
              </div>
              <div className="flex flex-col items-center gap-2.5">
                <TeamBadge team={away} size="xl" ring />
                <span className="text-center text-[13px] font-bold text-[var(--glass-ink)]">
                  {away.name}
                </span>
              </div>
            </div>

            <Link
              href={`/matches/${featured.id}`}
              className="mt-5 block rounded-xl bg-navy py-2.5 text-center text-[13px] font-black text-white transition hover:bg-navy-soft"
            >
              Match centre
            </Link>
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Reveal>
          <section className={`overflow-hidden ${glass}`}>
            <PanelHeading title="Today" href="/matches" />
            {data.today.length > 0 ? (
              data.today.map((match) => <GlassMatchRow key={match.id} match={match} />)
            ) : (
              <p className="px-4 py-6 text-center text-[13px] text-[var(--glass-ink-soft)]">
                No matches scheduled today.
              </p>
            )}
          </section>
        </Reveal>

        <Reveal delay={80}>
          <section className={`overflow-hidden ${glass}`}>
            <PanelHeading title="Latest results" href="/matches?status=results" />
            {data.recent.slice(0, 4).map((match) => (
              <GlassMatchRow key={match.id} match={match} />
            ))}
          </section>
        </Reveal>
      </div>

      <Reveal delay={120} className="mt-5">
        <section className={`overflow-hidden ${glass}`}>
          <PanelHeading title="Conference table" href="/standings" />
          {data.standings.slice(0, 5).map((line) => (
            <Link
              key={line.team.slug}
              href={`/teams/${line.team.slug}`}
              className="flex items-center gap-3 border-b border-[var(--glass-rule)] px-4 py-2.5 transition last:border-0 hover:bg-[var(--glass-hover)]"
            >
              <span className="w-4 text-[12px] font-black text-[var(--glass-ink-faint)] tabular-nums">
                {line.rank}
              </span>
              <TeamBadge team={line.team} size="xs" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--glass-ink)]">
                {line.team.name}
              </span>
              <span className="text-[11px] text-[var(--glass-ink-faint)] tabular-nums">
                {played(line.row.conference)} GP
              </span>
              <span className="w-9 text-right text-[14px] font-black text-[var(--glass-ink)] tabular-nums">
                {line.row.conference.pts}
              </span>
            </Link>
          ))}
        </section>
      </Reveal>
    </div>
  );
}
