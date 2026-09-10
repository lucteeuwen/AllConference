import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamBadge } from "@/components/TeamBadge";
import { Tabs } from "@/components/Tabs";
import { Card } from "@/components/Card";
import { StandingsTable, type StandingsEntry } from "@/components/StandingsTable";
import { formatFullDate, formatKickoff } from "@/lib/format";
import {
  computeStandings,
  getMatch,
  getPlayer,
  requireTeam,
} from "@/lib/selectors";
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

const eventIcon: Record<MatchEvent["type"], string> = {
  goal: "⚽",
  "own-goal": "⚽",
  penalty: "⚽",
  yellow: "🟨",
  red: "🟥",
};

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
    <div className="flex items-baseline justify-between gap-4 border-b border-line/70 py-2.5 last:border-0">
      <span className="text-[13px] text-ink-muted">{label}</span>
      <span className="text-right text-[13px] font-semibold text-ink">{value}</span>
    </div>
  );
}

function LineupColumn({ slug, lineup }: { slug: string; lineup: { starters: string[]; subs: string[] } }) {
  const team = requireTeam(slug);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2.5">
        <TeamBadge team={team} size="sm" />
        <span className="text-sm font-bold text-ink">{team.name}</span>
      </div>
      <p className="mb-2 text-[11px] font-bold tracking-wide text-ink-faint uppercase">Starting XI</p>
      <ul className="space-y-1.5">
        {lineup.starters.map((id) => {
          const player = getPlayer(id);
          if (!player) return null;
          return (
            <li key={id} className="flex items-center gap-2.5 text-[13px]">
              <span className="w-6 shrink-0 text-right font-bold tabular-nums text-ink-faint">
                {player.number}
              </span>
              <span className="truncate font-medium text-ink">{player.name}</span>
              <span className="ml-auto shrink-0 text-[11px] font-semibold text-ink-faint">
                {player.position}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 mb-2 text-[11px] font-bold tracking-wide text-ink-faint uppercase">
        Substitutes
      </p>
      <ul className="space-y-1.5">
        {lineup.subs.map((id) => {
          const player = getPlayer(id);
          if (!player) return null;
          return (
            <li key={id} className="flex items-center gap-2.5 text-[13px] text-ink-muted">
              <span className="w-6 shrink-0 text-right font-bold tabular-nums text-ink-faint">
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
  const hasLineups = Boolean(match.lineups);

  const tabs = [
    { key: "details", label: "Details", href: `/matches/${match.id}?tab=details` },
    ...(hasLineups
      ? [{ key: "lineups", label: "Lineups", href: `/matches/${match.id}?tab=lineups` }]
      : []),
    { key: "standings", label: "Standings", href: `/matches/${match.id}?tab=standings` },
  ];
  const active = tabs.some((tab) => tab.key === requested) ? (requested as string) : "details";

  const entries: StandingsEntry[] = computeStandings().map((row) => ({
    row,
    team: requireTeam(row.teamSlug),
  }));

  return (
    <>
      <div className="-mx-4 mb-5 bg-gradient-to-b from-navy to-navy-deep px-4 pt-4 md:mx-0 md:mt-6 md:rounded-card md:px-6">
        <div className="flex items-center justify-between">
          <Link
            href="/matches"
            className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Back to matches"
          >
            <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold tracking-wide text-white/80 uppercase">
            {match.isConference ? "CCIW Conference" : "Non-conference"}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 py-6">
          <div className="flex flex-col items-center gap-2.5">
            <TeamBadge team={home} size="xl" ring />
            <span className="text-center text-[13px] font-semibold text-white">{home.name}</span>
            <span className="text-[11px] text-white/50">Home</span>
          </div>

          <div className="pt-4 text-center">
            {match.home.score !== null && match.away.score !== null ? (
              <div className="text-4xl font-black tabular-nums text-white md:text-5xl">
                {match.home.score} <span className="text-white/35">-</span> {match.away.score}
              </div>
            ) : (
              <div className="text-2xl font-black text-white">{formatKickoff(match.date)}</div>
            )}
            <p className="mt-1.5 text-[11px] font-semibold tracking-wide text-white/60 uppercase">
              {match.status === "live" ? `${match.minute}' · In progress` : statusCopy[match.status]}
            </p>
          </div>

          <div className="flex flex-col items-center gap-2.5">
            <TeamBadge team={away} size="xl" ring />
            <span className="text-center text-[13px] font-semibold text-white">{away.name}</span>
            <span className="text-[11px] text-white/50">Away</span>
          </div>
        </div>

        <Tabs tabs={tabs} active={active} tone="light" />
      </div>

      {active === "details" ? (
        <div className="space-y-4">
          <Card>
            <DetailRow label="Kickoff" value={formatFullDate(match.date)} />
            <DetailRow label="Venue" value={match.venue} />
            <DetailRow label="Competition" value={match.isConference ? "CCIW Conference" : "Non-conference"} />
            {match.referee ? <DetailRow label="Referee" value={match.referee} /> : null}
            {match.attendance ? (
              <DetailRow label="Attendance" value={match.attendance.toLocaleString("en-US")} />
            ) : null}
          </Card>

          <Card>
            <h2 className="mb-3 text-[15px] font-bold text-ink">Timeline</h2>
            {match.events.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-muted">
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
                      <span className="w-9 shrink-0 rounded-full bg-ground py-0.5 text-center text-[11px] font-bold tabular-nums text-ink-muted">
                        {event.minute}&apos;
                      </span>
                      <span aria-hidden="true" className="text-sm">
                        {eventIcon[event.type]}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                        {eventLabel(event)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>
      ) : null}

      {active === "lineups" && match.lineups ? (
        <Card>
          <div className="grid gap-8 md:grid-cols-2">
            <LineupColumn slug={match.home.teamSlug} lineup={match.lineups.home} />
            <LineupColumn slug={match.away.teamSlug} lineup={match.lineups.away} />
          </div>
        </Card>
      ) : null}

      {active === "standings" ? <StandingsTable entries={entries} /> : null}
    </>
  );
}
