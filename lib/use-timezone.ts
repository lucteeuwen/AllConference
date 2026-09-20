"use client";

import { useSyncExternalStore } from "react";
import { FALLBACK_TZ, isValidTimeZone, resolveViewerTimeZone } from "@/lib/timezone";

/**
 * The reader's time zone, as a store rather than a context.
 *
 * `getServerSnapshot` drives both the server render and the browser's
 * hydration render, so the markup React builds while hydrating is identical to
 * the HTML it received. Only afterwards does React compare the client snapshot,
 * see a different zone and schedule an ordinary re-render. That is why nothing
 * here needs `suppressHydrationWarning`: there is no mismatch to suppress, and
 * reaching for one would mean this pattern had been broken.
 *
 * A module store rather than a provider so a `<LocalTime>` leaf can read the
 * zone deep inside an otherwise server-rendered tree, with no ancestor's help.
 */

let current: string | null = null;
const listeners = new Set<() => void>();

/** Cached: `getSnapshot` must return a stable value, and resolving is not free. */
function snapshot(): string {
  if (current) return current;
  // `?tz=Europe/Amsterdam` renders the page as a reader there would see it,
  // which is the only practical way to check this work without travelling.
  const override =
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("tz");
  current = override && isValidTimeZone(override) ? override : resolveViewerTimeZone();
  return current;
}

function serverSnapshot(): string {
  return FALLBACK_TZ;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** Overrides the zone for the whole page. Used by the `?tz=` dev override. */
export function setTimeZone(tz: string): void {
  if (current === tz || !isValidTimeZone(tz)) return;
  current = tz;
  listeners.forEach((listener) => listener());
}

export function useTimeZone(): string {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
