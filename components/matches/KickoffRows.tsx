"use client";

import { DetailRow } from "@/components/DetailRow";
import {
  dayKeyIn,
  formatDayKeyLong,
  formatFullDate,
  formatKickoff,
  formatZoneAbbr,
} from "@/lib/format";
import { sameWallClock } from "@/lib/timezone";
import { useTimeZone } from "@/lib/use-timezone";
import type { Match } from "@/lib/types";

/** The kickoff on its own, for the hero and the compact card. */
export function KickoffValue({ match }: { match: Pick<Match, "date" | "timeTbd"> }) {
  const tz = useTimeZone();
  return <>{formatKickoff(match.date, tz, match.timeTbd)}</>;
}

/**
 * Kickoff in the reader's own zone, and — only when the ground keeps a
 * different clock — what time the players actually walk out there.
 *
 * With no kickoff published there is no instant to convert: the stored date is
 * a day anchor, so it is rendered from the venue's own calendar (every reader
 * sees the same day) and the venue row is left off, because "TBA" is already
 * the same answer everywhere.
 */
export function KickoffRows({ match }: { match: Match }) {
  const tz = useTimeZone();

  if (match.timeTbd) {
    return (
      <DetailRow
        label="Kickoff"
        value={`${formatDayKeyLong(dayKeyIn(match.date, match.timezone))} · time TBA`}
      />
    );
  }

  const elsewhere = !sameWallClock(tz, match.timezone, Date.parse(match.date));

  return (
    <>
      <DetailRow
        label="Kickoff"
        value={`${formatFullDate(match.date, tz, false)} ${formatZoneAbbr(match.date, tz)}`}
        note="your time"
      />
      {elsewhere ? (
        <DetailRow
          label="Local at venue"
          value={`${formatKickoff(match.date, match.timezone, false)} ${formatZoneAbbr(match.date, match.timezone)}`}
        />
      ) : null}
    </>
  );
}
