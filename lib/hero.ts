import { effectiveStatus, scheduledEndMs, type LiveTiming } from "@/lib/live";
import type { Match } from "@/lib/types";

/**
 * When the home page's match box is up. Shared by the server (which picks the
 * match) and the browser (which hides and relabels it on the minute).
 *
 *   kickoff − 15 min   "Starting in 12 min" / "Starting soon"
 *   kickoff … end      live badge with an estimated match minute
 *   end … end + 15 min "Full time"
 *
 * `end` is when the scraper first saw the result; without it, when the match
 * should have finished (see `lib/live.ts`).
 */

export const HERO_LEAD_MS = 15 * 60_000;
export const HERO_TAIL_MS = 15 * 60_000;

export type HeroTiming = LiveTiming & {
  finishedAt: string | null;
};

export type HeroPhase = "pre" | "starting" | "live" | "post" | "hidden";

export function heroPhase(timing: HeroTiming, now: number): HeroPhase {
  const kickoff = new Date(timing.kickoff).getTime();
  const { status } = effectiveStatus(timing, now);

  switch (status) {
    case "live":
      return "live";
    case "full-time": {
      const end = timing.finishedAt ? new Date(timing.finishedAt).getTime() : scheduledEndMs(timing);
      return now <= end + HERO_TAIL_MS ? "post" : "hidden";
    }
    case "scheduled":
      if (timing.timeTbd || now < kickoff - HERO_LEAD_MS) return "hidden";
      return now < kickoff - 60_000 ? "pre" : "starting";
    default:
      return "hidden";
  }
}

export function minutesUntil(kickoff: string, now: number): number {
  return Math.max(1, Math.ceil((new Date(kickoff).getTime() - now) / 60_000));
}

const PRIORITY: Record<HeroPhase, number> = { live: 0, starting: 1, pre: 2, post: 3, hidden: 9 };

export function timingOf(match: Match): HeroTiming {
  return {
    kickoff: match.date,
    finishedAt: match.finishedAt,
    startedAt: match.startedAt ?? null,
    status: match.status,
    timeTbd: match.timeTbd,
  };
}

/** The match the box should show right now, or null to hide it. */
export function pickHeroMatch(matches: Match[], now: number): Match | null {
  return (
    matches
      .map((match) => ({ match, phase: heroPhase(timingOf(match), now) }))
      .filter(({ match, phase }) => phase !== "hidden" && match.home.teamSlug && match.away.teamSlug)
      .sort(
        (a, b) =>
          PRIORITY[a.phase] - PRIORITY[b.phase] ||
          // Soonest kickoff first, but the latest finish first.
          (a.phase === "post"
            ? b.match.date.localeCompare(a.match.date)
            : a.match.date.localeCompare(b.match.date)),
      )[0]?.match ?? null
  );
}
