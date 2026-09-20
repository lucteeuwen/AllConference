"use client";

import { useSyncExternalStore } from "react";

/**
 * The current time, stepped rather than continuous so snapshots stay stable
 * between ticks. `renderedAt` is the server's clock at render, which the
 * hydration pass uses so the browser's first paint agrees with the HTML even
 * when the two clocks straddle a minute — or a midnight.
 */

const TICK_MS = 15_000;

function subscribe(onTick: () => void) {
  const timer = setInterval(onTick, TICK_MS);
  return () => clearInterval(timer);
}

function snapshot() {
  return Math.floor(Date.now() / TICK_MS) * TICK_MS;
}

export function useNow(renderedAt: number): number {
  return useSyncExternalStore(subscribe, snapshot, () => renderedAt);
}
