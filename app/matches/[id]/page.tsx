import { Fragment } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DetailRow } from "@/components/DetailRow";
import { EventIcon, type EventIconType } from "@/components/EventIcon";
import { KickoffRows, KickoffValue } from "@/components/matches/KickoffRows";
import { WashHero } from "@/components/broadcast/WashHero";
import { OverlapCard } from "@/components/broadcast/OverlapCard";
import { Boxscore } from "@/components/broadcast/Boxscore";
import { sideName } from "@/components/broadcast/MatchRow";
import { LiveRefresh } from "@/components/LiveRefresh";
import { MatchHeroScore } from "@/components/matches/MatchHeroScore";
import { MatchVideo } from "@/components/MatchVideo";
import { PlayerLink } from "@/components/PlayerLink";
import { RankedTag } from "@/components/RankedTag";
import { TeamBadge } from "@/components/TeamBadge";
import { TeamComparison } from "@/components/TeamComparison";
import { Tabs } from "@/components/Tabs";
import { compareTeams } from "@/lib/comparison";
import { getCardCounts, getSeasonData, withDetails } from "@/lib/season-data";
import { timingOf } from "@/lib/hero";
import { nameKey, playerLookup, splitAssists, type PlayerLookup } from "@/lib/players";
import { effectiveStatus } from "@/lib/live";
import { renderedAt } from "@/lib/rendered-at";
import { verifyVideo } from "@/lib/video-verify";
import {
  competitionLabel,
  conferenceStarted,
  displayStandings,
  getMatch,
  standingsLines,
} from "@/lib/selectors";
import type { Lineup, MatchEvent, MatchSide } from "@/lib/types";

type Props = PageProps<"/matches/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const match = getMatch(await getSeasonData(), id);
  if (!match) return { title: "Match not found" };
  return {
    title: `${sideName(match.home)} vs ${sideName(match.away)}`,
  };
}

/** Some schools leave the player blank, which their box score prints as "0". */
const hasName = (name: string) => !/^(unknown|\d*)$/i.test(name.trim());

function EventLabel({ event, lookup }: { event: MatchEvent; lookup: PlayerLookup }) {
  const player = event.playerName;
  const named = hasName(player);
  const name = <PlayerLink player={lookup(event.teamSlug, player)}>{player}</PlayerLink>;
  if (event.type === "yellow") return named ? <>{name} booked</> : "Yellow card";
  if (event.type === "red") return named ? <>{name} sent off</> : "Red card";
  if (event.type === "penalty") return named ? <>{name} (pen.)</> : "Penalty goal";
  if (event.type === "own-goal") return "Own goal";
  if (!named) return "Goal";
  const assists = splitAssists(event.assistName ?? "").filter(hasName);
  if (assists.length === 0) return name;
  return (
    <>
      {name}, assist{" "}
      {assists.map((assist, index) => (
        <Fragment key={index}>
          {index > 0 ? " & " : null}
          <PlayerLink player={lookup(event.teamSlug, assist)}>{assist}</PlayerLink>
        </Fragment>
      ))}
    </>
  );
}

type PlayerMark = { minute: number; kind: EventIconType };

/** The goals, assists and cards in `events` that belong to one lineup player. */
function playerMarks(events: MatchEvent[], side: MatchSide, name: string, lookup: PlayerLookup): PlayerMark[] {
  const me = lookup(side.teamSlug, name);
  const key = nameKey(name);
  const isMe = (other: string) => {
    const player = lookup(side.teamSlug, other);
    return me && player ? me.id === player.id : nameKey(other) === key;
  };
  const marks: PlayerMark[] = [];
  for (const event of events) {
    if (event.teamSlug !== side.teamSlug) continue;
    if (isMe(event.playerName)) marks.push({ minute: event.minute, kind: event.type });
    if (event.assistName && splitAssists(event.assistName).some(isMe)) {
      marks.push({ minute: event.minute, kind: "assist" });
    }
  }
  return marks.sort((a, b) => a.minute - b.minute);
}

function PlayerMarks({ marks }: { marks: PlayerMark[] }) {
  return (
    <span className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-0.5">
      {marks.map((mark, index) => (
        <span key={index} className="flex items-center gap-1">
          <span className="text-[0.68rem] font-semibold text-ink-muted tabular-nums">{mark.minute}&apos;</span>
          <EventIcon type={mark.kind} />
        </span>
      ))}
    </span>
  );
}

function LineupColumn({
  side,
  lineup,
  events,
  lookup,
}: {
  side: MatchSide;
  lineup: Lineup;
  events: MatchEvent[];
  lookup: PlayerLookup;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2.5">
        <TeamBadge team={side.team} size="sm" />
        <span className="text-[0.85rem] font-bold text-ink">{sideName(side)}</span>
        <RankedTag team={side.team} />
      </div>
      <p className="bc-label mb-2 text-[0.65rem] text-ink-faint">Starting XI</p>
      <ul className="space-y-1.5">
        {lineup.starters.map((player, index) => (
          <li key={index} className="flex items-center gap-2.5 text-[0.78rem]">
            <span className="w-6 shrink-0 text-right font-bold text-ink-faint tabular-nums">
              {player.number ?? ""}
            </span>
            <PlayerLink player={lookup(side.teamSlug, player.name)} className="truncate font-medium text-ink">
              {player.name}
            </PlayerLink>
            <PlayerMarks marks={playerMarks(events, side, player.name, lookup)} />
            <span className="w-5 shrink-0 text-left text-[0.68rem] font-semibold text-ink-faint">
              {player.position ?? ""}
            </span>
          </li>
        ))}
      </ul>
      {lineup.subs.length > 0 ? (
        <>
          <p className="bc-label mt-4 mb-2 text-[0.65rem] text-ink-faint">Substitutes</p>
          <ul className="space-y-1.5">
            {lineup.subs.map((player, index) => (
              <li key={index} className="flex items-center gap-2.5 text-[0.78rem] text-ink-muted">
                <span className="w-6 shrink-0 text-right font-bold text-ink-faint tabular-nums">
                  {player.number ?? ""}
                </span>
                <PlayerLink player={lookup(side.teamSlug, player.name)} className="truncate">
                  {player.name}
                </PlayerLink>
                <PlayerMarks marks={playerMarks(events, side, player.name, lookup)} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="bc-label inline-flex rounded-control border border-line px-3 py-2 text-[0.68rem] text-ink-muted transition hover:border-accent hover:text-accent"
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export default async function MatchPage({ params, searchParams }: Props) {
  const { id } = await params;
  const data = await getSeasonData();
  const base = getMatch(data, id);
  if (!base) notFound();
  const match = await withDetails(base);
  const video = await verifyVideo(match.video, match, data.teams);

  const query = await searchParams;
  const requested = Array.isArray(query.tab) ? query.tab[0] : query.tab;

  const home = match.home.team;
  const away = match.away.team;
  const now = renderedAt();
  const timing = timingOf(match);
  const effective = effectiveStatus(timing, now).status;
  const live = effective === "live";
  const hasScore = match.home.score !== null && match.away.score !== null;

  const tabs = [
    { key: "details", label: "Details", href: `/matches/${match.id}?tab=details` },
    ...(match.lineups
      ? [{ key: "lineups", label: "Lineups", href: `/matches/${match.id}?tab=lineups` }]
      : []),
    { key: "teams", label: "Team stats", href: `/matches/${match.id}?tab=teams` },
  ];
  const active = tabs.some((tab) => tab.key === requested) ? (requested as string) : "details";

  const standings = standingsLines(data);
  const lookup = playerLookup(data.players);

  return (
    <div className="bc-stack pt-4 md:pt-6">
      <LiveRefresh timings={[timing]} renderedAt={now} />
      <section>
        <WashHero home={home} away={away} celebrate={live ? match.id : false}>
          <div className="mb-5 flex items-center justify-between">
            <BackButton fallbackHref="/matches" label="Back">
              <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </BackButton>
            <div className="flex items-center gap-2">
              <span className="bc-label rounded-control bg-white/10 px-3 py-1.5 text-[0.66rem] text-white/80">
                {competitionLabel(match, true)}
              </span>
              <ThemeToggle tone="onDark" className="md:hidden" />
            </div>
          </div>

          <p className="bc-label text-[0.8rem] text-white/70 md:text-[0.92rem]">
            {sideName(match.home)} <span className="text-white/35">@</span> {sideName(match.away)}
          </p>

          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
            <div className="slide-from-left flex flex-col items-center gap-2.5">
              <TeamBadge team={home} size="xl" ring />
              <span className="flex flex-wrap items-center justify-center gap-1.5 text-center text-[0.78rem] font-semibold text-white">
                {sideName(match.home)}
                <RankedTag team={home} onDark />
              </span>
              <span className="text-[0.68rem] text-white/50">Home</span>
            </div>

            <MatchHeroScore
              timing={timing}
              homeScore={match.home.score}
              awayScore={match.away.score}
              homePens={match.home.pens}
              awayPens={match.away.pens}
              renderedAt={now}
            />

            <div className="slide-from-right flex flex-col items-center gap-2.5">
              <TeamBadge team={away} size="xl" ring />
              <span className="flex flex-wrap items-center justify-center gap-1.5 text-center text-[0.78rem] font-semibold text-white">
                {sideName(match.away)}
                <RankedTag team={away} onDark />
              </span>
              <span className="text-[0.68rem] text-white/50">Away</span>
            </div>
          </div>
        </WashHero>

        <OverlapCard>
          {hasScore ? (
            <Boxscore match={match} standings={standings} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <DetailRow label="Kickoff" value={<KickoffValue match={match} />} />
              <DetailRow label="Venue" value={match.venue || "TBA"} />
              <DetailRow label="Competition" value={competitionLabel(match)} />
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
            {video ? (
              <div className="bc-card bc-pad bc-shadow lg:col-span-2">
                <h2 className="bc-label mb-3 text-[0.7rem] text-ink-faint">
                  {!video.exact ? "Where to watch" : effective === "full-time" ? "Watch the replay" : "Watch"}
                </h2>
                <MatchVideo video={video} live={live} />
              </div>
            ) : null}

            <div className="bc-card bc-pad bc-shadow">
              <h2 className="bc-label mb-2 text-[0.7rem] text-ink-faint">Match facts</h2>
              <KickoffRows match={match} />
              <DetailRow label="Venue" value={match.venue || "TBA"} />
              <DetailRow label="Competition" value={competitionLabel(match, true)} />
              {match.referee ? <DetailRow label="Referee" value={match.referee} /> : null}
              {match.attendance ? (
                <DetailRow label="Attendance" value={match.attendance.toLocaleString("en-US")} />
              ) : null}
              {match.boxscoreUrl || match.recapUrl ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {match.boxscoreUrl ? <ExternalLink href={match.boxscoreUrl}>Official box score</ExternalLink> : null}
                  {match.recapUrl ? <ExternalLink href={match.recapUrl}>Match recap</ExternalLink> : null}
                </div>
              ) : null}
            </div>

            <div className="bc-card bc-pad bc-shadow">
              <h2 className="bc-label mb-3 text-[0.7rem] text-ink-faint">Timeline</h2>
              {match.events.length === 0 ? (
                <p className="py-4 text-center text-[0.82rem] text-ink-muted">
                  {effective === "scheduled"
                    ? "Events appear here once the match kicks off."
                    : live
                      ? "Goals and cards appear here as they are recorded."
                      : effective === "full-time" && !(match.home.score === 0 && match.away.score === 0)
                        ? "The timeline appears once the box score is published."
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
                          <EventLabel event={event} lookup={lookup} />
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
              <LineupColumn side={match.home} lineup={match.lineups.home} events={match.events} lookup={lookup} />
              <LineupColumn side={match.away} lineup={match.lineups.away} events={match.events} lookup={lookup} />
            </div>
          </div>
        ) : null}

        {active === "teams" && match.home.teamSlug && match.away.teamSlug ? (
          <TeamComparison
            comparison={compareTeams({
              home,
              away,
              matchId: match.id,
              matches: data.matches,
              players: data.players,
              ranks: Object.fromEntries(displayStandings(standings).map((line) => [line.team.slug, line.rank])),
              conference: Object.fromEntries(standings.map((line) => [line.team.slug, line.row.conference])),
              conferenceStarted: conferenceStarted(standings),
              cards: await getCardCounts([match.home.teamSlug, match.away.teamSlug]),
            })}
            home={home}
            away={away}
            renderedAt={now}
          />
        ) : null}
        {active === "teams" && !(match.home.teamSlug && match.away.teamSlug) ? (
          <div className="bc-card bc-pad bc-shadow text-center text-[0.82rem] text-ink-muted">
            The teams for this match aren&apos;t decided yet, so there is nothing to compare.
          </div>
        ) : null}
      </div>
    </div>
  );
}
