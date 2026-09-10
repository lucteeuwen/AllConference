import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { TeamBadge } from "@/components/TeamBadge";
import { tint } from "@/lib/color";
import { SEASON_LABEL } from "@/lib/data/season";
import { computeStandings, getConferenceTeams, requireTeam } from "@/lib/selectors";

export const metadata: Metadata = {
  title: "Teams",
};

/**
 * The dummy schedule is generated relative to the current date, so these
 * derived pages must not be frozen into the build output. Remove this once a
 * real backend supplies dated data and normal caching applies.
 */
export const dynamic = "force-dynamic";

export default function TeamsPage() {
  const records = new Map(computeStandings().map((row) => [row.teamSlug, row]));

  return (
    <>
      <PageHeader title="Teams" subtitle={`${SEASON_LABEL} · Nine CCIW members`} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {getConferenceTeams().map((team) => {
          const record = records.get(team.slug)?.conference;
          return (
            <Link
              key={team.slug}
              href={`/teams/${team.slug}`}
              className="group rounded-card border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-accent/40 hover:shadow-[0_10px_28px_-18px_rgba(67,56,202,0.55)]"
              style={{ background: `linear-gradient(180deg, ${tint(team.primary, 0.06)}, #fff 70%)` }}
            >
              <div className="flex items-center gap-3">
                <TeamBadge team={team} size="md" />
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink group-hover:text-accent">
                    {requireTeam(team.slug).name}
                  </p>
                  <p className="truncate text-[12px] text-ink-muted">
                    {team.nickname} · {team.location}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[12px] font-semibold text-ink-muted tabular-nums">
                {record ? `${record.w}-${record.l}-${record.d} CCIW · ${record.pts} pts` : "No results yet"}
              </p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
