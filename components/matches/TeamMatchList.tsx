"use client";

import { EarlierMatches } from "@/components/EarlierMatches";
import { LiveRefresh } from "@/components/LiveRefresh";
import { MatchRow } from "@/components/broadcast/MatchRow";
import { matchDayKey } from "@/lib/format";
import { timingOf } from "@/lib/hero";
import { useViewerDay } from "@/lib/use-viewer-day";
import type { Match } from "@/lib/types";

/**
 * A team's season, split at today with the finished days behind a button. The
 * split runs in the browser because "today" and the day a kickoff falls on are
 * both read in the reader's own zone; the server renders the conference's zone
 * so the first paint is complete and correct for almost everyone.
 */
export function TeamMatchList({
  fixtures,
  showPast,
  base,
  renderedAt,
}: {
  fixtures: Match[];
  showPast: boolean;
  /** The matches tab's own URL, which the disclosure appends `&past=1` to. */
  base: string;
  renderedAt: number;
}) {
  const { tz, today } = useViewerDay(renderedAt);

  if (fixtures.length === 0) return null;

  const past = fixtures.filter((match) => matchDayKey(match, tz) < today);
  const current = fixtures.filter((match) => matchDayKey(match, tz) >= today);

  const rows = (list: Match[]) => (
    <div className="space-y-2.5">
      {list.map((match) => (
        <MatchRow key={match.id} match={match} renderedAt={renderedAt} showDate />
      ))}
    </div>
  );

  // A season with nothing left to play reads better newest first.
  const refresh = <LiveRefresh timings={fixtures.map(timingOf)} renderedAt={renderedAt} />;

  if (current.length === 0) {
    return (
      <>
        {refresh}
        {rows([...fixtures].reverse())}
      </>
    );
  }

  return (
    <div className="space-y-7">
      {refresh}
      {past.length > 0 ? (
        <EarlierMatches count={past.length} open={showPast} openHref={`${base}&past=1`} closeHref={base}>
          {rows(past)}
        </EarlierMatches>
      ) : null}
      {rows(current)}
    </div>
  );
}
