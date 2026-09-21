"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { inWatchWindow, type LiveTiming } from "@/lib/live";
import { useNow } from "@/lib/use-now";

const LIVE_MS = 30_000;

/**
 * Re-renders the page from the server while a match is on, or about to be, so
 * a score or a final result shows up without a reload. With `idleMs` it also
 * refreshes at that pace the rest of the time (the home page uses this so its
 * match box can appear); without, it does nothing until a match is near.
 */
export function LiveRefresh({
  timings,
  renderedAt,
  idleMs,
}: {
  timings: LiveTiming[];
  renderedAt: number;
  idleMs?: number;
}) {
  const router = useRouter();
  const now = useNow(renderedAt);
  const watching = timings.some((timing) => inWatchWindow(timing, now));
  const everyMs = watching ? LIVE_MS : idleMs;

  useEffect(() => {
    if (!everyMs) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, everyMs);
    return () => clearInterval(timer);
  }, [everyMs, router]);

  return null;
}
