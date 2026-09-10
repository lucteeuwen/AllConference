import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/Card";
import { MatchCard } from "@/components/MatchCard";
import { Tabs } from "@/components/Tabs";
import { TeamBadge } from "@/components/TeamBadge";
import { FormDots } from "@/components/FormDots";
import { readableInk } from "@/lib/color";
import { conferenceSlugs } from "@/lib/data/teams";
import { SEASON_LABEL } from "@/lib/data/season";
import { computeStandings, getRoster, getTeam, matchesForTeam, played } from "@/lib/selectors";
import type { Player } from "@/lib/types";

type Props = PageProps<"/teams/[slug]">;

export function generateStaticParams() {
  return [...conferenceSlugs].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const team = getTeam(slug);
  return { title: team ? team.fullName : "Team not found" };
}

const positionOrder: Player["position"][] = ["GK", "D", "M", "F"];
const positionLabels: Record<Player["position"], string> = {
  GK: "Goalkeepers",
  D: "Defenders",
  M: "Midfielders",
  F: "Forwards",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2.5 text-center">
      <p className="text-lg font-black tabular-nums text-white">{value}</p>
      <p className="text-[11px] tracking-wide text-white/60 uppercase">{label}</p>
    </div>
  );
}

export default async function TeamPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const team = getTeam(slug);
  if (!team || !conferenceSlugs.has(slug)) notFound();

  const query = await searchParams;
  const requested = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const active = requested === "schedule" ? "schedule" : "roster";

  const row = computeStandings().find((entry) => entry.teamSlug === slug);
  const roster = getRoster(slug);
  const fixtures = matchesForTeam(slug);
  const results = fixtures.filter((match) => match.status === "final").reverse();
  const upcoming = fixtures.filter((match) => match.status !== "final");
  const ink = readableInk(team.primary);

  const tabs = [
    { key: "roster", label: `Roster (${roster.length})`, href: `/teams/${slug}?tab=roster` },
    { key: "schedule", label: `Schedule (${fixtures.length})`, href: `/teams/${slug}?tab=schedule` },
  ];

  return (
    <>
      <div
        className="-mx-4 mb-5 px-4 pt-4 md:mx-0 md:mt-6 md:rounded-card md:px-6"
        style={{
          background: `linear-gradient(160deg, ${team.primary} 0%, #0a1e3c 100%)`,
          color: ink,
        }}
      >
        <Link
          href="/teams"
          className="flex size-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          aria-label="Back to teams"
        >
          <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>

        <div className="flex items-center gap-4 py-5">
          <TeamBadge team={team} size="xl" ring />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black tracking-tight text-white">
              {team.fullName}
            </h1>
            <p className="mt-0.5 truncate text-[13px] text-white/70">
              {team.nickname} · {team.location} · {SEASON_LABEL}
            </p>
            {row ? (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] tracking-wide text-white/60 uppercase">Form</span>
                <FormDots form={row.form} />
              </div>
            ) : null}
          </div>
        </div>

        {row ? (
          <div className="grid grid-cols-4 gap-2 pb-5">
            <Stat label="CCIW" value={`${row.conference.w}-${row.conference.l}-${row.conference.d}`} />
            <Stat label="Points" value={String(row.conference.pts)} />
            <Stat label="Overall" value={`${row.overall.w}-${row.overall.l}-${row.overall.d}`} />
            <Stat label="GF / GA" value={`${row.overall.gf}/${row.overall.ga}`} />
          </div>
        ) : null}

        <Tabs tabs={tabs} active={active} tone="light" />
      </div>

      {active === "roster" ? (
        <div className="space-y-4">
          {positionOrder.map((position) => {
            const group = roster.filter((player) => player.position === position);
            if (group.length === 0) return null;

            return (
              <Card key={position} flush>
                <h2 className="border-b border-line px-4 py-3 text-[13px] font-bold tracking-wide text-ink-muted uppercase">
                  {positionLabels[position]}
                </h2>

                {/* Table on desktop, stacked rows on phones. */}
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full min-w-[560px] border-collapse text-sm">
                    <thead>
                      <tr className="text-left text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
                        <th scope="col" className="w-12 py-2 pl-4 font-semibold">#</th>
                        <th scope="col" className="py-2 font-semibold">Name</th>
                        <th scope="col" className="py-2 font-semibold">Yr</th>
                        <th scope="col" className="py-2 font-semibold">Ht</th>
                        <th scope="col" className="py-2 font-semibold">Hometown</th>
                        <th scope="col" className="py-2 text-center font-semibold">GP</th>
                        <th scope="col" className="py-2 text-center font-semibold">G</th>
                        <th scope="col" className="py-2 pr-4 text-center font-semibold">A</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.map((player) => (
                        <tr key={player.id} className="border-t border-line/70">
                          <td className="py-2.5 pl-4 font-bold tabular-nums text-ink-faint">
                            {player.number}
                          </td>
                          <td className="py-2.5 font-semibold text-ink">{player.name}</td>
                          <td className="py-2.5 text-ink-muted">{player.year}</td>
                          <td className="py-2.5 tabular-nums text-ink-muted">{player.height}</td>
                          <td className="py-2.5 text-ink-muted">{player.hometown}</td>
                          <td className="py-2.5 text-center tabular-nums text-ink-muted">{player.stats.gp}</td>
                          <td className="py-2.5 text-center tabular-nums text-ink-muted">{player.stats.goals}</td>
                          <td className="py-2.5 pr-4 text-center tabular-nums text-ink-muted">{player.stats.assists}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="sm:hidden">
                  {group.map((player) => (
                    <li key={player.id} className="flex items-center gap-3 border-t border-line/70 px-4 py-3">
                      <span className="w-7 shrink-0 text-center text-[15px] font-black tabular-nums text-ink-faint">
                        {player.number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{player.name}</p>
                        <p className="truncate text-[12px] text-ink-muted">
                          {player.year} · {player.height} · {player.hometown}
                        </p>
                      </div>
                      <span className="shrink-0 text-right text-[12px] text-ink-muted tabular-nums">
                        {player.stats.goals}G {player.stats.assists}A
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-7">
          {upcoming.length > 0 ? (
            <section>
              <h2 className="mb-3 px-1 text-[15px] font-bold text-ink">Upcoming</h2>
              <div className="space-y-2.5">
                {upcoming.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </section>
          ) : null}

          {results.length > 0 ? (
            <section>
              <h2 className="mb-3 px-1 text-[15px] font-bold text-ink">
                Results{row ? ` · ${played(row.overall)} played` : ""}
              </h2>
              <div className="space-y-2.5">
                {results.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
