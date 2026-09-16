import type { Match } from "@/lib/types";

/**
 * When the home page's match box is up. Shared by the server (which picks the
 * match) and the browser (which hides and relabels it on the minute).
 *
 *   kickoff − 15 min   "Starting in 12 min" / "Starting soon"
 *   kickoff … end      live badge ("In progress" if the feed has no minute)
 *   end … end + 15 min "Full time"
 *
 * `end` is when the scraper first saw the result; without it, kickoff + 2 h.
 */

export const HERO_LEAD_MS = 15 * 60_000;
export const HERO_TAIL_MS = 15 * 60_000;
/** Schools rarely flag a match as live, so assume it started after this. */
export const START_GRACE_MS = 10 * 60_000;
const ASSUMED_LENGTH_MS = 120 * 60_000;

export type HeroTiming = {
  kickoff: string;
  finishedAt: string | null;
  status: Match["status"];
};

export type HeroPhase = "pre" | "starting" | "live" | "post" | "hidden";

export function heroPhase(timing: HeroTiming, now: number): HeroPhase {
  const kickoff = new Date(timing.kickoff).getTime();
  const end = timing.finishedAt
    ? new Date(timing.finishedAt).getTime()
    : kickoff + ASSUMED_LENGTH_MS;

  switch (timing.status) {
    case "live":
      return "live";
    case "final":
      return now <= end + HERO_TAIL_MS ? "post" : "hidden";
    case "scheduled":
      if (now < kickoff - HERO_LEAD_MS) return "hidden";
      if (now < kickoff + START_GRACE_MS) return now < kickoff - 60_000 ? "pre" : "starting";
      // The feed never flagged it live; give up once it would long be over.
      return now <= kickoff + ASSUMED_LENGTH_MS + HERO_TAIL_MS ? "live" : "hidden";
    default:
      return "hidden";
  }
}

export function minutesUntil(kickoff: string, now: number): number {
  return Math.max(1, Math.ceil((new Date(kickoff).getTime() - now) / 60_000));
}

const PRIORITY: Record<HeroPhase, number> = { live: 0, starting: 1, pre: 2, post: 3, hidden: 9 };

export function timingOf(match: Match): HeroTiming {
  return { kickoff: match.date, finishedAt: match.finishedAt, status: match.status };
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
