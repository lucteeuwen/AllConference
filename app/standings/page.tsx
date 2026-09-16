import type { Metadata } from "next";
import { Lockup, SectionHeader } from "@/components/broadcast/Lockup";
import { ScorersSnippet } from "@/components/broadcast/StandingsSnippet";
import { StandingsTable, type StandingsEntry } from "@/components/StandingsTable";
import { Reveal } from "@/components/broadcast/Reveal";
import { Bracket } from "@/components/Bracket";
import { getTopScorers, standingsLines } from "@/lib/selectors";
import { SEASON_LABEL } from "@/lib/season";
import { getSeasonData } from "@/lib/season-data";

export const metadata: Metadata = {
  title: "Standings",
};

export const revalidate = 60;

export default async function StandingsPage() {
  const data = await getSeasonData();
  const entries: StandingsEntry[] = standingsLines(data).map(({ row, team }) => ({ row, team }));
  const scorers = getTopScorers(data, 8);

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
        <section id="tournament" className="scroll-mt-6">
          <SectionHeader title="CCIW Tournament" />
          <div className="bc-card bc-pad">
            <Bracket bracket={data.bracket} matches={data.matches} teams={data.teams} />
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section id="scoring-leaders" className="scroll-mt-6">
          <SectionHeader title="Scoring leaders" />
          <ScorersSnippet scorers={scorers} />
        </section>
      </Reveal>
    </div>
  );
}
