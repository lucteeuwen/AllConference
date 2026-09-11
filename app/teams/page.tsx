import type { Metadata } from "next";
import Link from "next/link";
import { Lockup } from "@/components/broadcast/Lockup";
import { TeamBadge } from "@/components/TeamBadge";
import { FormDots } from "@/components/FormDots";
import { SEASON_LABEL } from "@/lib/data/season";
import { computeStandings, getConferenceTeams, played } from "@/lib/selectors";

export const metadata: Metadata = {
  title: "Teams",
};

/** The dummy schedule is generated relative to today, so this cannot be frozen. */
export const dynamic = "force-dynamic";

export default function TeamsPage() {
  const records = new Map(computeStandings().map((row) => [row.teamSlug, row]));
  const teams = getConferenceTeams();

  return (
    <div className="bc-stack">
      <Lockup
        title="Teams"
        subtitle={`${SEASON_LABEL} · CCIW members`}
        aside={
          <span className="bc-label rounded-control bg-white/10 px-3 py-1.5 text-[0.66rem] text-white/80">
            {teams.length} teams
          </span>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team, index) => {
          const row = records.get(team.slug);
          return (
            <Link
              key={team.slug}
              href={`/teams/${team.slug}`}
              style={{ animationDelay: `${index * 45}ms` }}
              className="bc-card rise-in group relative overflow-hidden transition hover:border-accent/50"
            >
              {/* The school's own colour washing in, as on the heroes. */}
              <span
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(var(--wash-angle), color-mix(in oklab, ${team.primary} calc(22% * var(--wash-strength)), transparent) -20%, transparent 62%)`,
                }}
              />
              <span
                aria-hidden="true"
                className="bc-watermark absolute -right-5 -bottom-7 leading-none font-black tracking-tighter select-none"
                style={{
                  color: team.primary,
                  opacity: "var(--wm-opacity)",
                  fontSize: "calc(5rem * var(--wm-scale))",
                }}
              >
                {team.abbr}
              </span>

              <div className="bc-pad relative">
                <div className="flex items-center gap-3">
                  <TeamBadge team={team} size="md" />
                  <div className="min-w-0">
                    <p className="bc-title truncate text-[0.95rem] text-ink group-hover:text-accent">
                      {team.name}
                    </p>
                    <p className="truncate text-[0.72rem] text-ink-muted">
                      {team.nickname} · {team.location}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-[0.72rem] font-semibold text-ink-muted tabular-nums">
                    {row
                      ? `${row.conference.w}-${row.conference.l}-${row.conference.d} · ${row.conference.pts} pts · ${played(row.conference)} GP`
                      : "No results yet"}
                  </span>
                  {row ? <FormDots form={row.form} /> : null}
                </div>
              </div>

              <span
                aria-hidden="true"
                className="bc-rule relative block"
                style={{ height: "var(--rule-height)", background: team.primary }}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
