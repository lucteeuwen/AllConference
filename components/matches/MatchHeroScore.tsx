"use client";

import { KickoffValue } from "@/components/matches/KickoffRows";
import { effectiveStatus, matchClock, type LiveTiming } from "@/lib/live";
import { useNow } from "@/lib/use-now";

const statusCopy = {
  scheduled: "Kickoff",
  live: "In progress",
  "full-time": "Full time",
  postponed: "Postponed",
  canceled: "Canceled",
} as const;

/**
 * The score in the match page's hero. It is worked out from the clock as well
 * as the stored status: a score shows from kickoff (nil-nil until one is
 * posted), and once the match should be over it reads "Full time" with a note
 * that the score is not confirmed until the final result has been saved.
 */
export function MatchHeroScore({
  timing,
  homeScore,
  awayScore,
  homePens,
  awayPens,
  renderedAt,
}: {
  timing: LiveTiming;
  homeScore: number | null;
  awayScore: number | null;
  homePens?: number | null;
  awayPens?: number | null;
  renderedAt: number;
}) {
  const now = useNow(renderedAt);
  const { status, unconfirmed } = effectiveStatus(timing, now);
  const live = status === "live";
  const known = homeScore !== null && awayScore !== null;
  const scores = known ? [homeScore, awayScore] : live ? [0, 0] : null;
  const shootout = known && homePens != null && awayPens != null;

  let caption: string = statusCopy[status];
  if (live) {
    const clock = matchClock(timing, now);
    caption = clock.halftime ? "Half time" : `${clock.label} · In progress`;
  }

  return (
    <div className="relative pt-3">
      {scores ? (
        <>
          {live ? (
            <span
              aria-hidden="true"
              className="score-bloom pointer-events-none absolute inset-0 flex items-center justify-center text-5xl font-black text-white"
            >
              {scores[1]}
            </span>
          ) : null}
          <div className="rise-in text-[2.4rem] font-black text-white tabular-nums md:text-[3rem]">
            {scores[0]}
            <span className="mx-2 text-white/30">-</span>
            {scores[1]}
          </div>
          {shootout ? (
            <p className="text-[0.72rem] font-bold text-white/70 tabular-nums">
              {homePens}–{awayPens} on penalties
            </p>
          ) : null}
        </>
      ) : status === "full-time" ? (
        <div className="text-2xl font-black text-white">–</div>
      ) : (
        <div className="text-2xl font-black text-white">
          <KickoffValue match={{ date: timing.kickoff, timeTbd: Boolean(timing.timeTbd) }} />
        </div>
      )}
      <p className="bc-label mt-1.5 text-[0.64rem] text-white/60">{caption}</p>
      {unconfirmed ? (
        <p className="mx-auto mt-1 max-w-[11rem] text-[0.62rem] leading-snug text-white/50">
          {known ? "Score may not be final yet" : "Final score not available yet"}
        </p>
      ) : null}
    </div>
  );
}
