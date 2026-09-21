import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DetailRow } from "@/components/DetailRow";
import { KickoffRows, KickoffValue } from "@/components/matches/KickoffRows";
import { WashHero } from "@/components/broadcast/WashHero";
import { OverlapCard } from "@/components/broadcast/OverlapCard";
import { Boxscore } from "@/components/broadcast/Boxscore";
import { sideName } from "@/components/broadcast/MatchRow";
import { LiveRefresh } from "@/components/LiveRefresh";
import { MatchHeroScore } from "@/components/matches/MatchHeroScore";
import { MatchVideo } from "@/components/MatchVideo";
import { TeamBadge } from "@/components/TeamBadge";
import { TeamComparison } from "@/components/TeamComparison";
import { Tabs } from "@/components/Tabs";
import { compareTeams } from "@/lib/comparison";
import { getCardCounts, getSeasonData, withDetails } from "@/lib/season-data";
import { timingOf } from "@/lib/hero";
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

/** Some schools leave the player blank, which their box score prints as "0". */
const hasName = (name: string) => !/^(unknown|\d*)$/i.test(name.trim());

function eventLabel(event: MatchEvent): string {
  const player = event.playerName;
  const named = hasName(player);
  if (event.type === "yellow") return named ? `${player} booked` : "Yellow card";
  if (event.type === "red") return named ? `${player} sent off` : "Red card";
  if (event.type === "penalty") return named ? `${player} (pen.)` : "Penalty goal";
  if (event.type === "own-goal") return "Own goal";
  if (!named) return "Goal";
  return event.assistName && hasName(event.assistName) ? `${player}, assist ${event.assistName}` : player;
}

function LineupColumn({ side, lineup }: { side: MatchSide; lineup: Lineup }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2.5">
        <TeamBadge team={side.team} size="sm" />
        <span className="text-[0.85rem] font-bold text-ink">{sideName(side)}</span>
      </div>
      <p className="bc-label mb-2 text-[0.65rem] text-ink-faint">Starting XI</p>
      <ul className="space-y-1.5">
        {lineup.starters.map((player, index) => (
          <li key={index} className="flex items-center gap-2.5 text-[0.78rem]">
            <span className="w-6 shrink-0 text-right font-bold text-ink-faint tabular-nums">
              {player.number ?? ""}
            </span>
            <span className="truncate font-medium text-ink">{player.name}</span>
            <span className="ml-auto shrink-0 text-[0.68rem] font-semibold text-ink-faint">
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
                <span className="truncate">{player.name}</span>
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
              <span className="text-center text-[0.78rem] font-semibold text-white">
                {sideName(match.home)}
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
              <span className="text-center text-[0.78rem] font-semibold text-white">
                {sideName(match.away)}
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
              <LineupColumn side={match.home} lineup={match.lineups.home} />
              <LineupColumn side={match.away} lineup={match.lineups.away} />
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
