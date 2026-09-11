import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WashHero } from "@/components/broadcast/WashHero";
import { OverlapCard } from "@/components/broadcast/OverlapCard";
import { Boxscore } from "@/components/broadcast/Boxscore";
import { StandingsSnippet } from "@/components/broadcast/StandingsSnippet";
import { TeamBadge } from "@/components/TeamBadge";
import { Tabs } from "@/components/Tabs";
import { formatFullDate, formatKickoff } from "@/lib/format";
import { computeStandings, getMatch, getPlayer, requireTeam } from "@/lib/selectors";
import type { Match, MatchEvent } from "@/lib/types";

type Props = PageProps<"/matches/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const match = getMatch(id);
  if (!match) return { title: "Match not found" };
  return {
    title: `${requireTeam(match.home.teamSlug).name} vs ${requireTeam(match.away.teamSlug).name}`,
  };
}

const statusCopy: Record<Match["status"], string> = {
  scheduled: "Kickoff",
  live: "In progress",
  final: "Full time",
  postponed: "Postponed",
};

/**
 * Drawn rather than set in emoji: emoji depend on a font the machine may not
 * have, and these need to read the same everywhere.
 */
function EventIcon({ type }: { type: MatchEvent["type"] }) {
  if (type === "yellow" || type === "red") {
    return (
      <span
        aria-hidden="true"
        className="block h-3.5 w-2.5 shrink-0 rounded-[2px]"
        style={{ background: type === "yellow" ? "#eab308" : "var(--loss)" }}
      />
    );
  }
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-ink" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 3.4l3 2.2-1.15 3.55h-3.7L5 5.6z" fill="currentColor" />
    </svg>
  );
}

function eventLabel(event: MatchEvent): string {
  const player = getPlayer(event.playerId)?.name ?? "Unknown";
  if (event.type === "yellow") return `${player} booked`;
  if (event.type === "red") return `${player} sent off`;
  if (event.type === "penalty") return `${player} (pen.)`;
  if (event.type === "own-goal") return `${player} (o.g.)`;
  const assist = event.assistPlayerId ? getPlayer(event.assistPlayerId)?.name : undefined;
  return assist ? `${player}, assist ${assist}` : player;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bc-row flex items-baseline justify-between gap-4 border-b border-line last:border-0">
      <span className="text-[0.78rem] text-ink-muted">{label}</span>
      <span className="text-right text-[0.78rem] font-semibold text-ink">{value}</span>
    </div>
  );
}

function LineupColumn({
  slug,
  lineup,
}: {
  slug: string;
  lineup: { starters: string[]; subs: string[] };
}) {
  const team = requireTeam(slug);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2.5">
        <TeamBadge team={team} size="sm" />
        <span className="text-[0.85rem] font-bold text-ink">{team.name}</span>
      </div>
      <p className="bc-label mb-2 text-[0.65rem] text-ink-faint">Starting XI</p>
      <ul className="space-y-1.5">
        {lineup.starters.map((id) => {
          const player = getPlayer(id);
          if (!player) return null;
          return (
            <li key={id} className="flex items-center gap-2.5 text-[0.78rem]">
              <span className="w-6 shrink-0 text-right font-bold text-ink-faint tabular-nums">
                {player.number}
              </span>
              <span className="truncate font-medium text-ink">{player.name}</span>
              <span className="ml-auto shrink-0 text-[0.68rem] font-semibold text-ink-faint">
                {player.position}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="bc-label mt-4 mb-2 text-[0.65rem] text-ink-faint">Substitutes</p>
      <ul className="space-y-1.5">
        {lineup.subs.map((id) => {
          const player = getPlayer(id);
          if (!player) return null;
          return (
            <li key={id} className="flex items-center gap-2.5 text-[0.78rem] text-ink-muted">
              <span className="w-6 shrink-0 text-right font-bold text-ink-faint tabular-nums">
                {player.number}
              </span>
              <span className="truncate">{player.name}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default async function MatchPage({ params, searchParams }: Props) {
  const { id } = await params;
  const match = getMatch(id);
  if (!match) notFound();

  const query = await searchParams;
  const requested = Array.isArray(query.tab) ? query.tab[0] : query.tab;

  const home = requireTeam(match.home.teamSlug);
  const away = requireTeam(match.away.teamSlug);
  const live = match.status === "live";
  const hasScore = match.home.score !== null && match.away.score !== null;

  const tabs = [
    { key: "details", label: "Details", href: `/matches/${match.id}?tab=details` },
    ...(match.lineups
      ? [{ key: "lineups", label: "Lineups", href: `/matches/${match.id}?tab=lineups` }]
      : []),
    { key: "standings", label: "Standings", href: `/matches/${match.id}?tab=standings` },
  ];
  const active = tabs.some((tab) => tab.key === requested) ? (requested as string) : "details";

  const standings = computeStandings().map((row, index) => ({
    row,
    team: requireTeam(row.teamSlug),
    rank: index + 1,
  }));

  return (
    <div className="bc-stack pt-4 md:pt-6">
      <section>
        <WashHero home={home} away={away} celebrate={live ? match.id : false}>
          <div className="mb-5 flex items-center justify-between">
            <Link
              href="/matches"
              className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Back to matches"
            >
              <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <span className="bc-label rounded-control bg-white/10 px-3 py-1.5 text-[0.66rem] text-white/80">
              {match.isConference ? "CCIW Conference" : "Non-conference"}
            </span>
          </div>

          <p className="bc-label text-[0.8rem] text-white/70 md:text-[0.92rem]">
            {home.name} <span className="text-white/35">@</span> {away.name}
          </p>

          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
            <div className="slide-from-left flex flex-col items-center gap-2.5">
              <TeamBadge team={home} size="xl" ring />
              <span className="text-center text-[0.78rem] font-semibold text-white">{home.name}</span>
              <span className="text-[0.68rem] text-white/50">Home</span>
            </div>

            <div className="relative pt-3">
              {hasScore ? (
                <>
                  {live ? (
                    <span
                      aria-hidden="true"
                      className="score-bloom pointer-events-none absolute inset-0 flex items-center justify-center text-5xl font-black text-white"
                    >
                      {match.away.score}
                    </span>
                  ) : null}
                  <div className="rise-in text-[2.4rem] font-black text-white tabular-nums md:text-[3rem]">
                    {match.home.score}
                    <span className="mx-2 text-white/30">-</span>
                    {match.away.score}
                  </div>
                </>
              ) : (
                <div className="text-2xl font-black text-white">{formatKickoff(match.date)}</div>
              )}
              <p className="bc-label mt-1.5 text-[0.64rem] text-white/60">
                {live ? `${match.minute}' · In progress` : statusCopy[match.status]}
              </p>
            </div>

            <div className="slide-from-right flex flex-col items-center gap-2.5">
              <TeamBadge team={away} size="xl" ring />
              <span className="text-center text-[0.78rem] font-semibold text-white">{away.name}</span>
              <span className="text-[0.68rem] text-white/50">Away</span>
            </div>
          </div>
        </WashHero>

        <OverlapCard>
          {hasScore ? (
            <Boxscore match={match} standings={standings} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <DetailRow label="Kickoff" value={formatKickoff(match.date)} />
              <DetailRow label="Venue" value={match.venue} />
              <DetailRow
                label="Competition"
                value={match.isConference ? "CCIW" : "Non-conference"}
              />
            </div>
          )}
        </OverlapCard>
      </section>

      <div>
        <div className="mb-5 px-1">
          <Tabs tabs={tabs} active={active} />
        </div>

        {active === "details" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="bc-card bc-pad bc-shadow">
              <h2 className="bc-label mb-2 text-[0.7rem] text-ink-faint">Match facts</h2>
              <DetailRow label="Kickoff" value={formatFullDate(match.date)} />
              <DetailRow label="Venue" value={match.venue} />
              <DetailRow
                label="Competition"
                value={match.isConference ? "CCIW Conference" : "Non-conference"}
              />
              {match.referee ? <DetailRow label="Referee" value={match.referee} /> : null}
              {match.attendance ? (
                <DetailRow label="Attendance" value={match.attendance.toLocaleString("en-US")} />
              ) : null}
            </div>

            <div className="bc-card bc-pad bc-shadow">
              <h2 className="bc-label mb-3 text-[0.7rem] text-ink-faint">Timeline</h2>
              {match.events.length === 0 ? (
                <p className="py-4 text-center text-[0.82rem] text-ink-muted">
                  {match.status === "scheduled"
                    ? "Events appear here once the match kicks off."
                    : "No goals or cards recorded."}
                </p>
              ) : (
                <ol className="space-y-2.5">
                  {match.events.map((event, index) => {
                    const isHome = event.teamSlug === match.home.teamSlug;
                    return (
                      <li
                        key={index}
                        className={`flex items-center gap-3 ${isHome ? "" : "flex-row-reverse text-right"}`}
                      >
                        <span className="w-9 shrink-0 rounded-control bg-ground py-0.5 text-center text-[0.68rem] font-bold text-ink-muted tabular-nums">
                          {event.minute}&apos;
                        </span>
                        <EventIcon type={event.type} />
                        <span className="min-w-0 flex-1 truncate text-[0.78rem] text-ink">
                          {eventLabel(event)}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        ) : null}

        {active === "lineups" && match.lineups ? (
          <div className="bc-card bc-pad bc-shadow">
            <div className="grid gap-8 md:grid-cols-2">
              <LineupColumn slug={match.home.teamSlug} lineup={match.lineups.home} />
              <LineupColumn slug={match.away.teamSlug} lineup={match.lineups.away} />
            </div>
          </div>
        ) : null}

        {active === "standings" ? <StandingsSnippet standings={standings} limit={9} /> : null}
      </div>
    </div>
  );
}
