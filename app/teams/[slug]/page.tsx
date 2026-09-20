import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { EarlierMatches } from "@/components/EarlierMatches";
import { WashHero } from "@/components/broadcast/WashHero";
import { OverlapCard } from "@/components/broadcast/OverlapCard";
import { MatchRow } from "@/components/broadcast/MatchRow";
import { ScoreboardRail } from "@/components/broadcast/ScoreboardRail";
import { Tabs } from "@/components/Tabs";
import { TeamBadge } from "@/components/TeamBadge";
import { FormDots } from "@/components/FormDots";
import { buildRailTiles } from "@/lib/rail";
import { SEASON_LABEL, dayKey, todayKey } from "@/lib/season";
import { recordFor } from "@/lib/standings";
import { getSeasonData } from "@/lib/season-data";
import {
  conferenceStarted,
  displayStandings,
  getRoster,
  getTeam,
  goalDifference,
  matchesForTeam,
  standingsLines,
} from "@/lib/selectors";
import type { Player } from "@/lib/types";

type Props = PageProps<"/teams/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const team = getTeam(await getSeasonData(), slug);
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
      <p className="text-[1.15rem] font-black text-ink tabular-nums">{value}</p>
      <p className="bc-label text-[0.62rem] text-ink-faint">{label}</p>
    </div>
  );
}

export default async function TeamPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const data = await getSeasonData();
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
  const shownRecord = row ? recordFor(row, "all", started) : undefined;

  const roster = getRoster(data, slug);
  const fixtures = matchesForTeam(data, slug);
  const { tiles, centerIndex } = buildRailTiles(fixtures, standings, 14);

  // Like the Matches page: the list starts today, earlier days sit behind a button.
  const today = todayKey();
  const past = fixtures.filter((match) => dayKey(match.date) < today);
  const current = fixtures.filter((match) => dayKey(match.date) >= today);
  const splitAtToday = current.length > 0;
  const base = `/teams/${slug}?tab=matches`;

  const tabs = [
    { key: "roster", label: `Roster (${roster.length})`, href: `/teams/${slug}?tab=roster` },
    { key: "matches", label: `Matches (${fixtures.length})`, href: base },
  ];

  return (
    <div className="bc-stack pt-4 md:pt-6">
      <section>
        <WashHero home={team}>
          <div className="mb-5 flex items-center justify-between">
            <BackButton fallbackHref="/teams" label="Back">
              <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </BackButton>
            <span className="bc-label rounded-control bg-white/10 px-3 py-1.5 text-[0.66rem] text-white/80">
              {SEASON_LABEL}
            </span>
          </div>

          <div className="slide-from-left flex flex-col items-center gap-3">
            <TeamBadge team={team} size="xl" ring />
            <div>
              <h1 className="bc-title text-[1.5rem] text-white md:text-[1.9rem]">
                {team.fullName}
              </h1>
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <Stat label="CCIW" value={`${row.conference.w}-${row.conference.l}-${row.conference.d}`} />
              <Stat
                label={started ? "Points" : "Points (all games)"}
                value={String(shownRecord?.pts ?? 0)}
              />
              <Stat label="Overall" value={`${row.overall.w}-${row.overall.l}-${row.overall.d}`} />
              <Stat label="Goals" value={`${row.overall.gf} / ${row.overall.ga}`} />
              <Stat
                label="Difference"
                value={`${goalDifference(row.overall) >= 0 ? "+" : ""}${goalDifference(row.overall)}`}
              />
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
                            <td className="bc-row font-semibold text-ink">{player.name}</td>
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
                      <li
                        key={player.id}
                        className="bc-row flex items-center gap-3 border-t border-line/70 px-4"
                      >
                        <span className="w-7 shrink-0 text-center text-[0.95rem] font-black text-ink-faint tabular-nums">
                          {player.number ?? ""}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.85rem] font-semibold text-ink">
                            {player.name}
                          </p>
                          <p className="truncate text-[0.72rem] text-ink-muted">
                            {[player.year, player.hometown].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <span className="shrink-0 text-right text-[0.72rem] text-ink-muted tabular-nums">
                          {player.stats.goals}G {player.stats.assists}A
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="[overflow-anchor:none]">
            {fixtures.length === 0 ? null : splitAtToday ? (
              <div className="space-y-7">
                {past.length > 0 ? (
                  <EarlierMatches
                    count={past.length}
                    open={showPast}
                    openHref={`${base}&past=1`}
                    closeHref={base}
                  >
                    <div className="space-y-2.5">
                      {past.map((match) => (
                        <MatchRow key={match.id} match={match} showDate />
                      ))}
                    </div>
                  </EarlierMatches>
                ) : null}
                <div className="space-y-2.5">
                  {current.map((match) => (
                    <MatchRow key={match.id} match={match} showDate />
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {[...fixtures].reverse().map((match) => (
                  <MatchRow key={match.id} match={match} showDate />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
