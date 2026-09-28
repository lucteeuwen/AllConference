"use client";

import { useState } from "react";
import { ScorersSnippet } from "@/components/broadcast/StandingsSnippet";
import { SlidingSegments } from "@/components/SlidingSegments";
import type { ScorerLine, ScorerStat } from "@/lib/selectors";

const stats: { value: ScorerStat; label: string }[] = [
  { value: "goals", label: "Goals" },
  { value: "assists", label: "Assists" },
];

/** The scoring leaders with a Goals / Assists switch; each list arrives already ranked. */
export function ScoringLeaders({
  goals,
  assists,
  initial,
}: {
  goals: ScorerLine[];
  assists: ScorerLine[];
  initial?: number;
}) {
  const [stat, setStat] = useState<ScorerStat>("goals");

  return (
    <ScorersSnippet
      scorers={stat === "goals" ? goals : assists}
      initial={initial}
      stat={stat}
      header={
        <SlidingSegments
          label="Scoring leaders stat"
          value={stat}
          onChange={setStat}
          options={stats}
          ringed={false}
          itemClassName="px-4"
        />
      }
    />
  );
}
