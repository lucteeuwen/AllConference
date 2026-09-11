import type { Metadata } from "next";
import { Lockup, SectionHeader } from "@/components/broadcast/Lockup";
import { ScorersSnippet } from "@/components/broadcast/StandingsSnippet";
import { StandingsTable, type StandingsEntry } from "@/components/StandingsTable";
import { Reveal } from "@/components/broadcast/Reveal";
import { computeStandings, getTopScorers, requireTeam } from "@/lib/selectors";
import { SEASON_LABEL } from "@/lib/data/season";

export const metadata: Metadata = {
  title: "Standings",
};

/**
 * The dummy schedule is generated relative to the current date, so this
 * derived page must not be frozen into the build output.
 */
export const dynamic = "force-dynamic";

export default function StandingsPage() {
  const entries: StandingsEntry[] = computeStandings().map((row) => ({
    row,
    team: requireTeam(row.teamSlug),
  }));

  return (
    <div className="bc-stack">
      <Lockup
        title="Standings"
        subtitle={`${SEASON_LABEL} · Conference record`}
        aside={
          <span className="bc-label rounded-control bg-white/10 px-3 py-1.5 text-[0.66rem] text-white/80">
            {entries.length} teams
          </span>
        }
      />

      <div>
        <StandingsTable entries={entries} />

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-[0.72rem] text-ink-muted">
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
      </div>

      <Reveal>
        <section id="scoring-leaders" className="scroll-mt-6">
          <SectionHeader title="Scoring leaders" />
          <ScorersSnippet scorers={getTopScorers(8)} />
        </section>
      </Reveal>
    </div>
  );
}
