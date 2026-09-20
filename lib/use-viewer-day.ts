"use client";

import { useMemo } from "react";
import { todayKeyIn } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import { useTimeZone } from "@/lib/use-timezone";

/**
 * The reader's zone and the reader's today, both stable through hydration.
 *
 * "Today" has to come from somewhere, and reading the browser's clock during
 * hydration is a mismatch waiting to happen that has nothing to do with zones:
 * if the server and the browser straddle midnight, one says "Today" where the
 * other says "Yesterday". Threading the server's `renderedAt` through `useNow`
 * removes that, and the clock catches up on the next tick.
 */
export function useViewerDay(renderedAt: number): { tz: string; today: string } {
  const tz = useTimeZone();
  const now = useNow(renderedAt);
  return useMemo(() => ({ tz, today: todayKeyIn(tz, 0, new Date(now)) }), [tz, now]);
}
