import Link from "next/link";
import { Reveal } from "@/components/home/Reveal";
import { Logo } from "@/components/Logo";
import { TeamBadge } from "@/components/TeamBadge";
import { formatKickoff, formatShortDate } from "@/lib/format";
import { goalDifference, played, requireTeam } from "@/lib/selectors";
import type { HomeData } from "@/lib/home";
import type { Match } from "@/lib/types";

/**
 * Design 4 — Broadsheet. Editorial and airy: oversized uppercase section
 * titles over hairline rules, and match rows carrying a bar in the home
 * school's colour down the left edge, with the kickoff time centred between two
 * condensed team names.
 */

function SectionTitle({ title, href, action }: { title: string; href?: string; action?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 border-b-2 border-ink pb-2">
      <h2 className="text-xl font-black tracking-[-0.02em] text-ink uppercase md:text-2xl">
        {title}
      </h2>
      {href && action ? (
        <Link
          href={href}
          className="shrink-0 pb-0.5 text-[11px] font-bold tracking-wide text-accent uppercase hover:underline"
        >
          {action}
        </Link>
      ) : null}
    </div>
  );
}

function BroadsheetRow({ match, index }: { match: Match; index: number }) {
  const home = requireTeam(match.home.teamSlug);
  const away = requireTeam(match.away.teamSlug);
  const decided = match.home.score !== null && match.away.score !== null;
  const live = match.status === "live";

  return (
    <Link
      href={`/matches/${match.id}`}
      className="group relative flex items-stretch gap-4 border-b border-line bg-surface py-3.5 pr-4 pl-5 transition last:border-0 hover:bg-ground"
    >
      <span
        aria-hidden="true"
        className="team-color bar-grow absolute inset-y-0 left-0 w-1"
        style={{ background: home.primary, animationDelay: `${index * 60}ms` }}
      />

      <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <TeamBadge team={home} size="sm" />
          <span className="truncate text-[13px] font-black tracking-tight text-ink uppercase">
            {home.name}
          </span>
        </span>

        <span className="text-center">
          {decided ? (
            <span className="block text-lg font-black text-ink tabular-nums">
              {match.home.score} <span className="text-ink-faint">-</span> {match.away.score}
            </span>
          ) : (
            <span className="block text-[15px] font-black text-accent tabular-nums">
              {formatKickoff(match.date)}
            </span>
          )}
          <span
            className={`mt-0.5 block text-[9px] font-bold tracking-[0.1em] uppercase ${
              live ? "text-live" : "text-ink-faint"
            }`}
          >
            {live ? `Live ${match.minute}'` : match.status === "final" ? "Final" : formatShortDate(match.date)}
          </span>
        </span>

        <span className="flex min-w-0 items-center justify-end gap-2.5">
          <span className="truncate text-right text-[13px] font-black tracking-tight text-ink uppercase">
            {away.name}
          </span>
          <TeamBadge team={away} size="sm" />
        </span>
      </div>
    </Link>
  );
}

export function BroadsheetHome({ data }: { data: HomeData }) {
  const leaders = data.standings.slice(0, 2);
  const maxPoints = Math.max(1, ...data.standings.map((line) => line.row.conference.pts));

  return (
    <div className="space-y-10 pt-6">
      <header className="border-b-4 border-ink pb-4">
        <div className="mb-3 flex items-center gap-3 border-b border-line pb-3">
          <Logo className="h-9 w-auto text-brand" gap="var(--surface)" title="AllConference" />
          <span className="text-[11px] font-bold tracking-[0.24em] text-ink-faint uppercase">
            AllConference
          </span>
        </div>
        <p className="text-[11px] font-bold tracking-[0.24em] text-accent uppercase">
          College Conference of Illinois and Wisconsin
        </p>
        <h1 className="mt-1.5 text-4xl leading-[0.95] font-black tracking-[-0.035em] text-ink uppercase md:text-6xl">
          Men&apos;s Soccer
        </h1>
        <p className="mt-2 text-[13px] text-ink-muted">
          {data.today.length} matches today · {data.standings.length} teams · 2026 season
        </p>
      </header>

      <section>
        <SectionTitle title="Today" href="/matches" action="All fixtures" />
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          {data.today.length > 0 ? (
            data.today.map((match, index) => (
              <BroadsheetRow key={match.id} match={match} index={index} />
            ))
          ) : (
            <p className="px-5 py-8 text-center text-[13px] text-ink-muted">
              No matches scheduled today.
            </p>
          )}
        </div>
      </section>

      <Reveal>
        <section>
          <SectionTitle title="Results" href="/matches?status=results" action="Archive" />
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            {data.recent.slice(0, 5).map((match, index) => (
              <BroadsheetRow key={match.id} match={match} index={index} />
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal delay={80}>
        <section>
          <SectionTitle title="Standings" href="/standings" action="Full table" />

          {leaders.length === 2 ? (
            <div className="mb-5 rounded-card border border-line bg-surface p-5">
              <p className="mb-4 text-[10px] font-bold tracking-[0.12em] text-ink-faint uppercase">
                Title race
              </p>
              {leaders.map((line) => (
                <div key={line.team.slug} className="mb-3 last:mb-0">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-2 text-[13px] font-black tracking-tight text-ink uppercase">
                      <TeamBadge team={line.team} size="xs" />
                      {line.team.name}
                    </span>
                    <span className="text-[13px] font-black text-ink tabular-nums">
                      {line.row.conference.pts} pts
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-ground">
                    <span
                      className="team-color block h-full rounded-full"
                      style={{
                        width: `${(line.row.conference.pts / maxPoints) * 100}%`,
                        background: line.team.primary,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-ink-faint tabular-nums">
                    {played(line.row.conference)} played · {goalDifference(line.row.conference) >= 0 ? "+" : ""}
                    {goalDifference(line.row.conference)} goal difference
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-card border border-line bg-surface">
            {data.standings.map((line) => (
              <Link
                key={line.team.slug}
                href={`/teams/${line.team.slug}`}
                className="flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-0 transition hover:bg-ground"
              >
                <span className="w-5 text-[12px] font-black text-ink-faint tabular-nums">
                  {line.rank}
                </span>
                <TeamBadge team={line.team} size="xs" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-black tracking-tight text-ink uppercase">
                  {line.team.name}
                </span>
                <span className="text-[11px] text-ink-faint tabular-nums">
                  {line.row.conference.w}-{line.row.conference.l}-{line.row.conference.d}
                </span>
                <span className="w-9 text-right text-[14px] font-black text-ink tabular-nums">
                  {line.row.conference.pts}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal delay={120}>
        <section>
          <SectionTitle title="Scoring leaders" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.scorers.map((line, index) => (
              <div key={line.player.id} className="rounded-card border border-line bg-surface p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-3xl font-black tracking-tighter text-ink-faint/40 tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <TeamBadge team={line.team} size="sm" />
                </div>
                <p className="truncate text-[14px] font-black tracking-tight text-ink">
                  {line.player.name}
                </p>
                <p className="text-[11px] text-ink-muted">
                  {line.team.name} · {line.player.position}
                </p>
                <p className="mt-2 border-t border-line pt-2 text-[12px] font-bold text-ink tabular-nums">
                  {line.player.stats.goals}G · {line.player.stats.assists}A
                  <span className="ml-2 text-accent">{line.points} pts</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      </Reveal>
    </div>
  );
}
