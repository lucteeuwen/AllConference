"use client";

import { LocalTime } from "@/components/LocalTime";
import { effectiveStatus, matchClock } from "@/lib/live";
import { timingOf } from "@/lib/hero";
import { useNow } from "@/lib/use-now";
import type { Match } from "@/lib/types";

/**
 * The parts of a match row that depend on the clock. The stored status lags the
 * game (see `lib/live.ts`), so each of these works out what to show from the
 * time as well, and stays right in an open tab.
 */

/** With `showDate`, an upcoming match shows its date here (the kickoff time then sits between the teams). */
export function StatusPill({
  match,
  renderedAt,
  showDate = false,
}: {
  match: Match;
  renderedAt: number;
  showDate?: boolean;
}) {
  const now = useNow(renderedAt);
  const timing = timingOf(match);
  const { status } = effectiveStatus(timing, now);

  if (status === "live") {
    const clock = matchClock(timing, now);
    return (
      <span className="bc-label flex shrink-0 items-center gap-1.5 rounded-control bg-live/10 px-2.5 py-1 text-[0.68rem] whitespace-nowrap text-live">
        <span className="live-dot size-1.5 rounded-full bg-live" />
        {clock.halftime ? "Half time" : <>Live {clock.label}</>}
      </span>
    );
  }
  if (status === "full-time") {
    return (
      <span className="bc-label shrink-0 rounded-control bg-ground px-2.5 py-1 text-[0.68rem] whitespace-nowrap text-ink-muted">
        Full time
      </span>
    );
  }
  if (status === "postponed" || status === "canceled") {
    return (
      <span className="bc-label shrink-0 rounded-control bg-amber-100 px-2.5 py-1 text-[0.68rem] whitespace-nowrap text-amber-700">
        {status === "postponed" ? "Postponed" : "Canceled"}
      </span>
    );
  }
  return (
    <span className="bc-label shrink-0 rounded-control bg-accent-soft px-2.5 py-1 text-[0.68rem] whitespace-nowrap text-accent">
      <LocalTime match={match} format={showDate ? "short" : "time"} />
    </span>
  );
}

/** The date that leads a row's label once the pill no longer shows it. */
export function DateLead({ match, renderedAt }: { match: Match; renderedAt: number }) {
  const { status } = effectiveStatus(timingOf(match), useNow(renderedAt));
  if (status === "scheduled") return null;
  return (
    <>
      <LocalTime match={match} format="short" />
      {" · "}
    </>
  );
}

/** The middle of a row: the score, or what stands in for one. */
export function RowCentre({
  match,
  renderedAt,
  homeWon,
  awayWon,
}: {
  match: Match;
  renderedAt: number;
  homeWon: boolean;
  awayWon: boolean;
}) {
  const { status } = effectiveStatus(timingOf(match), useNow(renderedAt));
  const known = match.home.score !== null && match.away.score !== null;
  const shootout = known && match.home.pens != null && match.away.pens != null;

  // Live with nothing posted yet is nil-nil. Once it should be over, a score
  // that never arrived stays unknown rather than being invented.
  const scores = known
    ? [match.home.score, match.away.score]
    : status === "live"
      ? [0, 0]
      : null;

  if (scores) {
    return (
      <span className="text-[1.3rem] font-black text-ink tabular-nums">
        <span className={awayWon ? "text-ink-faint" : ""}>{scores[0]}</span>
        <span className="mx-1.5 text-ink-faint">&ndash;</span>
        <span className={homeWon ? "text-ink-faint" : ""}>{scores[1]}</span>
        {shootout ? (
          <span className="block text-[0.62rem] font-bold text-ink-faint">
            ({match.home.pens}&ndash;{match.away.pens} pens)
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span className="text-[0.82rem] font-bold text-ink-muted">
      {status === "postponed" ? (
        "PPD"
      ) : status === "canceled" || status === "full-time" ? (
        "—"
      ) : (
        <LocalTime match={match} />
      )}
    </span>
  );
}
