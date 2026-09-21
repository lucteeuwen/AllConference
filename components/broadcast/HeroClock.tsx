"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { heroPhase, minutesUntil, type HeroTiming } from "@/lib/hero";
import { effectiveStatus, matchClock } from "@/lib/live";
import { useNow } from "@/lib/use-now";

/**
 * The home page's match box lives on a clock: it appears 15 minutes before
 * kickoff and leaves 15 minutes after full time. These pieces keep that honest
 * in an open tab without a reload.
 */

/** Hides its children once the match leaves the window. */
export function HeroWindow({
  timing,
  renderedAt,
  children,
}: {
  timing: HeroTiming;
  renderedAt: number;
  children: ReactNode;
}) {
  const phase = heroPhase(timing, useNow(renderedAt));
  const router = useRouter();
  const last = useRef(phase);

  // A phase change usually means fresher data exists (a score, a new match).
  useEffect(() => {
    if (last.current === phase) return;
    last.current = phase;
    router.refresh();
  }, [phase, router]);

  return phase === "hidden" ? null : children;
}

export function HeroStatus({ timing, renderedAt }: { timing: HeroTiming; renderedAt: number }) {
  const now = useNow(renderedAt);
  const phase = heroPhase(timing, now);

  if (phase === "live") {
    const clock = matchClock(timing, now);
    return (
      <span className="mb-2 inline-flex items-center gap-1.5 rounded-control bg-win px-3 py-1 text-[0.7rem] font-black text-white tabular-nums">
        <span className="live-dot size-1.5 rounded-full bg-white" />
        {clock.halftime ? "Half time" : clock.label}
      </span>
    );
  }

  const label =
    phase === "pre"
      ? `Starting in ${minutesUntil(timing.kickoff, now)} min`
      : phase === "starting"
        ? "Starting soon"
        : "Full time";

  return (
    <span className="mb-2 inline-block rounded-control bg-white/15 px-3 py-1 text-[0.7rem] font-bold text-white/85">
      {label}
    </span>
  );
}

/** The box's score: nil-nil from kickoff until one is posted, "VS" before it. */
export function HeroScore({
  timing,
  homeScore,
  awayScore,
  renderedAt,
}: {
  timing: HeroTiming;
  homeScore: number | null;
  awayScore: number | null;
  renderedAt: number;
}) {
  const { status } = effectiveStatus(timing, useNow(renderedAt));
  const live = status === "live";
  const known = homeScore !== null && awayScore !== null;
  const scores = known ? [homeScore, awayScore] : live ? [0, 0] : null;

  if (!scores) {
    return (
      <div className="text-2xl font-black text-white md:text-3xl">{status === "full-time" ? "–" : "VS"}</div>
    );
  }
  return (
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
    </>
  );
}
