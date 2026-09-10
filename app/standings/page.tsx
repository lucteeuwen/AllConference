import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { StandingsTable, type StandingsEntry } from "@/components/StandingsTable";
import { computeStandings, requireTeam } from "@/lib/selectors";
import { SEASON_LABEL } from "@/lib/data/season";

export const metadata: Metadata = {
  title: "Standings",
};

/**
 * The dummy schedule is generated relative to the current date, so these
 * derived pages must not be frozen into the build output. Remove this once a
 * real backend supplies dated data and normal caching applies.
 */
export const dynamic = "force-dynamic";

export default function StandingsPage() {
  const entries: StandingsEntry[] = computeStandings().map((row) => ({
    row,
    team: requireTeam(row.teamSlug),
  }));

  return (
    <>
      <PageHeader title="Standings" subtitle={`${SEASON_LABEL} · Conference record`} />

      <StandingsTable entries={entries} />

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-win" /> Win
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-draw" /> Draw
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-loss" /> Loss
        </span>
        <span className="text-ink-faint">
          Three points for a win, one for a draw. Form shows the last five results, oldest first.
        </span>
      </div>
    </>
  );
}
