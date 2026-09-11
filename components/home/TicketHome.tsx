import Link from "next/link";
import { Reveal } from "@/components/home/Reveal";
import { Logo } from "@/components/Logo";
import { TeamBadge } from "@/components/TeamBadge";
import { formatKickoff, formatShortDate } from "@/lib/format";
import { played, requireTeam } from "@/lib/selectors";
import type { HomeData } from "@/lib/home";
import type { Match } from "@/lib/types";

/**
 * Design 3 — Matchday Ticket. Every match is a stub: notches bitten out of the
 * left and right edges level with the score, and a dashed perforation running
 * between them. The notch is a radial-gradient mask in the card's own
 * background, which keeps the shape in one element and theme-aware.
 */

const NOTCH = 13;

function stubBackground(): React.CSSProperties {
  return {
    // Two transparent circles punched into the surface fill at the midpoint.
    background: `
      radial-gradient(circle ${NOTCH}px at 0% 58%, transparent 98%, var(--surface) 100%),
      radial-gradient(circle ${NOTCH}px at 100% 58%, transparent 98%, var(--surface) 100%)
    `,
    backgroundSize: "51% 100%, 51% 100%",
    backgroundPosition: "left center, right center",
    backgroundRepeat: "no-repeat",
  };
}

function TicketStub({ match, index }: { match: Match; index: number }) {
  const home = requireTeam(match.home.teamSlug);
  const away = requireTeam(match.away.teamSlug);
  const live = match.status === "live";
  const decided = match.home.score !== null && match.away.score !== null;

  const phase = live
    ? `${(match.minute ?? 0) <= 45 ? "1st" : "2nd"} half · ${match.minute}'`
    : match.status === "final"
      ? "Full time"
      : match.status === "postponed"
        ? "Postponed"
        : `${formatShortDate(match.date)} · ${formatKickoff(match.date)}`;

  return (
    <Link
      href={`/matches/${match.id}`}
      style={{ ...stubBackground(), animationDelay: `${index * 70}ms` }}
      className="rise-in relative block overflow-hidden rounded-card ring-1 ring-line transition hover:ring-accent/50"
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-[10px] font-black tracking-[0.12em] text-ink-faint uppercase">
          {match.isConference ? "CCIW Conference" : "Non-conference"}
        </span>
        {live ? (
          <span className="relative flex items-center gap-1.5 rounded-full bg-live px-2.5 py-0.5 text-[10px] font-black tracking-wide text-white uppercase">
            <span aria-hidden="true" className="radio-wave absolute inset-0 rounded-full bg-live/50" />
            <span className="relative">Live</span>
          </span>
        ) : null}
      </div>

      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3">
        <div className="flex flex-col items-center gap-1.5">
          <TeamBadge team={home} size="md" />
          <span className="text-center text-[12px] font-bold text-ink">{home.name}</span>
        </div>

        <div className="relative px-5 text-center">
          {/* The perforation the notches bite into. */}
          <span
            aria-hidden="true"
            className="absolute -top-3 -bottom-3 left-0 w-px overflow-hidden"
            style={{
              backgroundImage: "repeating-linear-gradient(to bottom, var(--line) 0 4px, transparent 4px 9px)",
            }}
          >
            <span className="perforation-shimmer absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-accent to-transparent" />
          </span>
          <span
            aria-hidden="true"
            className="absolute -top-3 -bottom-3 right-0 w-px"
            style={{
              backgroundImage: "repeating-linear-gradient(to bottom, var(--line) 0 4px, transparent 4px 9px)",
            }}
          />

          <div className="text-2xl font-black text-ink tabular-nums">
            {decided ? (
              <>
                {match.home.score}
                <span className="mx-1.5 text-ink-faint">:</span>
                {match.away.score}
              </>
            ) : (
              <span className="text-[15px] text-ink-muted">VS</span>
            )}
          </div>
          <p className="mt-1 text-[9px] font-bold tracking-[0.08em] text-ink-faint uppercase whitespace-nowrap">
            {phase}
          </p>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <TeamBadge team={away} size="md" />
          <span className="text-center text-[12px] font-bold text-ink">{away.name}</span>
        </div>
      </div>

      <p className="truncate border-t border-dashed border-line px-4 py-2 text-center text-[10px] text-ink-faint">
        {match.venue}
      </p>
    </Link>
  );
}

export function TicketHome({ data }: { data: HomeData }) {
  const month = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const headline = [...data.today, ...data.upcoming].slice(0, 4);

  return (
    <div className="space-y-7 pt-5">
      <header className="relative overflow-hidden rounded-card bg-brand px-5 py-5 text-white">
        <Logo
          className="pointer-events-none absolute -right-6 -bottom-6 h-28 w-auto text-white/15"
          gap="transparent"
        />
        <p className="text-[10px] font-black tracking-[0.2em] uppercase opacity-70">
          Admit one
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight">CCIW Matchday</h1>
        <p className="mt-1 text-[12px] opacity-75">Every fixture, result and stub this season</p>
      </header>

      <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-2.5">
        <button
          type="button"
          disabled
          aria-label="Previous month"
          className="flex size-7 items-center justify-center rounded-full border border-line text-ink-faint"
        >
          <svg viewBox="0 0 16 16" className="size-3 rotate-180" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="text-[14px] font-black tracking-tight text-ink">{month}</p>
        <button
          type="button"
          disabled
          aria-label="Next month"
          className="flex size-7 items-center justify-center rounded-full border border-line text-ink-faint"
        >
          <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <section>
        <h2 className="mb-3 px-1 text-[15px] font-black tracking-tight text-ink">Matchday</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {headline.map((match, index) => (
            <TicketStub key={match.id} match={match} index={index} />
          ))}
        </div>
      </section>

      <Reveal>
        <section>
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-[15px] font-black tracking-tight text-ink">Latest results</h2>
            <Link href="/matches?status=results" className="text-[12px] font-bold text-accent hover:underline">
              See all
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.recent.slice(0, 4).map((match, index) => (
              <TicketStub key={match.id} match={match} index={index} />
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal delay={80}>
        <section>
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-[15px] font-black tracking-tight text-ink">Standings</h2>
            <Link href="/standings" className="text-[12px] font-bold text-accent hover:underline">
              Full table
            </Link>
          </div>
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            {data.standings.slice(0, 6).map((line) => (
              <Link
                key={line.team.slug}
                href={`/teams/${line.team.slug}`}
                className="flex items-center gap-3 border-b border-dashed border-line px-4 py-2.5 last:border-0 transition hover:bg-ground"
              >
                <span className="w-4 text-[12px] font-black text-ink-faint tabular-nums">{line.rank}</span>
                <TeamBadge team={line.team} size="xs" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">
                  {line.team.name}
                </span>
                <span className="text-[11px] text-ink-faint tabular-nums">
                  {played(line.row.conference)} GP
                </span>
                <span className="w-9 text-right text-[14px] font-black text-ink tabular-nums">
                  {line.row.conference.pts}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </Reveal>
    </div>
  );
}
