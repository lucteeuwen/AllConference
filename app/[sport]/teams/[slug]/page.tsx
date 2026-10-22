import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { SiteMenu } from "@/components/SiteMenu";
import { Headline } from "@/components/broadcast/Headline";
import { WashHero } from "@/components/broadcast/WashHero";
import { OverlapCard } from "@/components/broadcast/OverlapCard";
import { TeamMatchList } from "@/components/matches/TeamMatchList";
import { ScoreboardRail } from "@/components/broadcast/ScoreboardRail";
import { Tabs } from "@/components/Tabs";
import { RankedTag } from "@/components/RankedTag";
import { TeamBadge } from "@/components/TeamBadge";
import { FormDots } from "@/components/FormDots";
import { PlayerLink } from "@/components/PlayerLink";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { playerHref } from "@/lib/players";
import { buildRailTiles } from "@/lib/rail";
import { SEASON_LABEL } from "@/lib/season";
import { pointsFor } from "@/lib/standings";
import { renderedAt } from "@/lib/rendered-at";
import { getRosterPhotos, getSeasonData } from "@/lib/season-data";
import {
  conferenceStarted,
  displayStandings,
  getRoster,
  getTeam,
  matchesForTeam,
  standingsLines,
} from "@/lib/selectors";
import { parseSport, sportHref, teamHref } from "@/lib/sport";
import type { Player } from "@/lib/types";

type Props = PageProps<"/[sport]/teams/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sport, slug } = await params;
  const team = getTeam(await getSeasonData(parseSport(sport)), slug);
  return { title: team ? team.fullName : "Team not found" };
}

// Some schools leave positions blank; those players are listed last.
const positionOrder: Player["position"][] = ["GK", "D", "M", "F", null];
const positionLabel = (position: Player["position"]) =>
  position === "GK"
    ? "Goalkeepers"
    : position === "D"
      ? "Defenders"
      : position === "M"
        ? "Midfielders"
        : position === "F"
          ? "Forwards"
          : "Squad";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="bc-score text-[1.6rem] leading-none font-black text-ink tabular-nums">{value}</p>
      <p className="bc-label text-[0.62rem] text-ink-faint">{label}</p>
    </div>
  );
}

export default async function TeamPage({ params, searchParams }: Props) {
  const { slug, sport: sportParam } = await params;
  const sport = parseSport(sportParam);
  const data = await getSeasonData(sport);
  const team = getTeam(data, slug);
  if (!team || !team.isConference) notFound();

  const query = await searchParams;
  const requested = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const active = requested === "matches" ? "matches" : "roster";
  const showPast = (Array.isArray(query.past) ? query.past[0] : query.past) === "1";

  const standings = standingsLines(data);
  const started = conferenceStarted(standings);
  // The same order as the standings table, so the badge always matches its `#`.
  const line = displayStandings(standings).find((entry) => entry.team.slug === slug);
  const row = line?.row;

  const roster = getRoster(data, slug);
  const photos = active === "roster" ? await getRosterPhotos(sport, slug) : new Map<string, string>();
  const fixtures = matchesForTeam(data, slug);
  const { tiles, centerIndex } = buildRailTiles(fixtures, standings, 14);

  const base = teamHref(sport, slug, "?tab=matches");

  const tabs = [
    { key: "roster", label: `Roster (${roster.length})`, href: teamHref(sport, slug, "?tab=roster") },
    { key: "matches", label: `Matches (${fixtures.length})`, href: base },
  ];

  return (
    <div className="bc-stack pt-4 md:pt-6">
      <section>
        <WashHero home={team}>
          <div className="mb-5 flex items-center justify-between">
            <BackButton fallbackHref={sportHref(sport, "/teams")} label="Back">
              <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </BackButton>
            <div className="flex items-center gap-2">
              <span className="bc-label rounded-control bg-white/10 px-3 py-1.5 text-[0.66rem] text-white/80">
                {SEASON_LABEL}
              </span>
              <SiteMenu className="md:hidden" />
            </div>
          </div>

          <div className="slide-from-left flex flex-col items-center gap-3">
            <TeamBadge team={team} size="xl" ring />
            <div>
              <Headline
                text={team.fullName}
                className="bc-title bc-headline-hero flex flex-wrap items-center justify-center gap-x-2 text-white"
              >
                <RankedTag team={team} onDark />
              </Headline>
              <p className="mt-1 text-[0.78rem] text-white/65">
                {team.nickname} · {team.location}
              </p>
            </div>
            {row && line ? (
              <div className="flex items-center gap-2">
                <span className="bc-label text-[0.62rem] text-white/55">Form</span>
                <FormDots form={row.form} />
                <span className="bc-label ml-1 rounded-control bg-white/12 px-2.5 py-1 text-[0.62rem] text-white/85">
                  {line.rank === 1 ? "1st" : line.rank === 2 ? "2nd" : line.rank === 3 ? "3rd" : `${line.rank}th`}{" "}
                  {started ? "in CCIW" : "by form"}
                </span>
              </div>
            ) : null}
          </div>
        </WashHero>

        {row ? (
          <OverlapCard>
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Games played" value={String(row.overall.w + row.overall.l + row.overall.d)} />
              <Stat label="CCIW points" value={String(pointsFor(row, "all", started))} />
              <Stat label="Goals" value={String(row.overall.gf)} />
            </div>
          </OverlapCard>
        ) : null}
      </section>

      {tiles.length > 0 ? (
        <div className="bc-rail">
          <ScoreboardRail tiles={tiles} centerIndex={centerIndex} />
        </div>
      ) : null}

      <div>
        <div className="mb-5 px-1">
          <Tabs tabs={tabs} active={active} />
        </div>

        {active === "roster" ? (
          <div className="space-y-4">
            {positionOrder.map((position) => {
              const group = roster.filter((player) => player.position === position);
              if (group.length === 0) return null;

              return (
                <div key={position ?? "squad"} className="bc-card bc-flush overflow-hidden">
                  <h2 className="bc-label border-b border-line px-4 py-3 text-[0.7rem] text-ink-muted">
                    {positionLabel(position)}
                  </h2>

                  {/* Table on desktop, stacked rows on phones. */}
                  <div className="hidden overflow-x-auto sm:block">
                    <table className="w-full min-w-[560px] border-collapse text-[0.85rem]">
                      <thead>
                        <tr className="bc-label text-left text-[0.65rem] text-ink-faint">
                          <th scope="col" className="w-12 py-2 pl-4">#</th>
                          <th scope="col" className="py-2">Name</th>
                          <th scope="col" className="py-2">Yr</th>
                          <th scope="col" className="py-2">Hometown</th>
                          <th scope="col" className="py-2 text-center">GP</th>
                          <th scope="col" className="py-2 text-center">G</th>
                          <th scope="col" className="py-2 pr-4 text-center">A</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.map((player) => (
                          <tr key={player.id} className="border-t border-line/70">
                            <td className="bc-row pl-4 font-bold text-ink-faint tabular-nums">
                              {player.number ?? ""}
                            </td>
                            <td className="bc-row font-semibold text-ink">
                              <span className="flex items-center gap-3">
                                <PlayerPhoto
                                  player={player}
                                  team={team}
                                  photoUrl={photos.get(player.id) ?? null}
                                  size={40}
                                  compact
                                />
                                <PlayerLink player={player}>{player.name}</PlayerLink>
                              </span>
                            </td>
                            <td className="bc-row text-ink-muted">{player.year}</td>
                            <td className="bc-row text-ink-muted">{player.hometown}</td>
                            <td className="bc-row text-center text-ink-muted tabular-nums">
                              {player.stats.gp}
                            </td>
                            <td className="bc-row text-center text-ink-muted tabular-nums">
                              {player.stats.goals}
                            </td>
                            <td className="bc-row pr-4 text-center text-ink-muted tabular-nums">
                              {player.stats.assists}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <ul className="sm:hidden">
                    {group.map((player) => (
                      <li key={player.id} className="border-t border-line/70">
                        <Link
                          href={playerHref(player)}
                          className="bc-row flex items-center gap-3 px-4 transition active:bg-ground"
                        >
                          <PlayerPhoto
                            player={player}
                            team={team}
                            photoUrl={photos.get(player.id) ?? null}
                            size={52}
                            compact
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[0.95rem] font-bold text-ink">
                              {player.name}
                            </p>
                            <p className="truncate text-[0.75rem] text-ink-muted">
                              {player.number !== null && player.number !== undefined ? (
                                <>
                                  <span className="bc-score font-black text-ink">{player.number}</span>
                                  {player.year || player.hometown ? " · " : null}
                                </>
                              ) : null}
                              {[player.year, player.hometown].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <span className="shrink-0 text-right text-[0.72rem] text-ink-muted tabular-nums">
                            {player.stats.goals}G {player.stats.assists}A
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="[overflow-anchor:none]">
            <TeamMatchList
              fixtures={fixtures}
              showPast={showPast}
              base={base}
              renderedAt={renderedAt()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
