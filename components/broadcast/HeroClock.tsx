"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { heroPhase, minutesUntil, type HeroTiming } from "@/lib/hero";
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

export function HeroStatus({
  timing,
  minute,
  renderedAt,
}: {
  timing: HeroTiming;
  minute?: number;
  renderedAt: number;
}) {
  const now = useNow(renderedAt);
  const phase = heroPhase(timing, now);

  if (phase === "live") {
    return (
      <span className="mb-2 inline-flex items-center gap-1.5 rounded-control bg-win px-3 py-1 text-[0.7rem] font-black text-white tabular-nums">
        <span className="live-dot size-1.5 rounded-full bg-white" />
        {minute ? `${minute}'` : "In progress"}
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

/** Re-renders the page from the server every minute, so a box can appear. */
export function AutoRefresh({ everyMs = 60_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, everyMs);
    return () => clearInterval(timer);
  }, [everyMs, router]);
  return null;
}
