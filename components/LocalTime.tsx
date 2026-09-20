"use client";

import { formatKickoff, formatShortDate } from "@/lib/format";
import { useTimeZone } from "@/lib/use-timezone";
import type { Match } from "@/lib/types";

/** Everything this needs off a match, so a scoreboard tile can supply it too. */
export type TimedMatch = Pick<Match, "date" | "timeTbd" | "timezone">;

/**
 * A kickoff, rendered in the reader's own zone. The server paints the
 * conference's zone and the browser corrects it after hydration, so this works
 * inside a cached page: the HTML is the same for everyone, and only the reader
 * sees their own time.
 *
 * With no kickoff published the date falls back to the venue's zone, because
 * the stored instant is only a day anchor. Reading that anchor in a reader's
 * own zone is how "Oct 31" turns into "Nov 1" somewhere east of the venue.
 *
 * The `dateTime` attribute carries the bare instant, so a crawler or a screen
 * reader gets the unambiguous value whichever string happens to be painted.
 */
export function LocalTime({
  match,
  format = "time",
}: {
  match: TimedMatch;
  /** "time" is the kickoff, "short" the date, "shortTime" both. */
  format?: "time" | "short" | "shortTime";
}) {
  const viewerTz = useTimeZone();
  const dateTz = match.timeTbd ? match.timezone : viewerTz;

  const time = () => formatKickoff(match.date, viewerTz, match.timeTbd);
  const date = () => formatShortDate(match.date, dateTz);

  const text =
    format === "time" ? time() : format === "short" ? date() : `${date()} · ${time()}`;

  return <time dateTime={match.date}>{text}</time>;
}
