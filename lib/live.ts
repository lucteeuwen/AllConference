import type { MatchStatus } from "@/lib/types";

/**
 * What a match looks like right now, worked out from the clock as well as from
 * what the scraper last stored. Schools rarely flag a match as live and post
 * the final score late, so the stored status alone lags the game: a match is
 * shown as live from kickoff, and as full time once it has had time to finish,
 * even while the database still says `scheduled`.
 *
 * Pure, so the browser (which keeps it ticking) and the scraper (which turns a
 * goal's minute back into a start time) share one clock.
 */

const MINUTE = 60_000;

export const HALF_MS = 45 * MINUTE;
export const HALFTIME_MS = 10 * MINUTE;
/** Two halves, halftime and a little stoppage time. */
export const SCHEDULED_END_MS = 110 * MINUTE;
/** How long after the start we keep expecting a final score to arrive. */
export const RESULT_WAIT_MS = 150 * MINUTE;
/** How long before kickoff a page is worth refreshing for. */
export const LEAD_MS = 15 * MINUTE;

export type LiveTiming = {
  /** ISO kickoff; a day anchor when `timeTbd`. */
  kickoff: string;
  /** ISO instant the scraper estimates play began, once it has seen it. */
  startedAt?: string | null;
  status: MatchStatus;
  timeTbd?: boolean;
};

export type EffectiveStatus = {
  status: "scheduled" | "live" | "full-time" | "postponed" | "canceled";
  /** Full time by the clock only: the final score has not reached the database. */
  unconfirmed: boolean;
};

function startOf(timing: LiveTiming): number {
  return Date.parse(timing.startedAt ?? timing.kickoff);
}

/** When the match should be over, by the clock. */
export function scheduledEndMs(timing: LiveTiming): number {
  return startOf(timing) + SCHEDULED_END_MS;
}

export function effectiveStatus(timing: LiveTiming, now: number): EffectiveStatus {
  if (timing.status === "final") return { status: "full-time", unconfirmed: false };
  if (timing.status === "postponed" || timing.status === "canceled") {
    return { status: timing.status, unconfirmed: false };
  }

  // Nothing to count from until a kickoff time is published.
  if (timing.timeTbd && !timing.startedAt) {
    return { status: timing.status === "live" ? "live" : "scheduled", unconfirmed: false };
  }

  if (timing.status === "scheduled" && now < startOf(timing)) return { status: "scheduled", unconfirmed: false };
  if (now >= scheduledEndMs(timing)) return { status: "full-time", unconfirmed: true };
  return { status: "live", unconfirmed: false };
}

/** True from shortly before kickoff until the result should have arrived. */
export function inWatchWindow(timing: LiveTiming, now: number): boolean {
  if (timing.status !== "scheduled" && timing.status !== "live") return false;
  if (timing.timeTbd && timing.status === "scheduled") return false;
  const start = startOf(timing);
  return now >= start - LEAD_MS && now <= start + RESULT_WAIT_MS;
}

export type MatchClock = {
  /** "34'", "HT" or "90+'". */
  label: string;
  minute: number | null;
  halftime: boolean;
};

/** Match minute counted up from the start, with a halftime break. */
export function matchClock(timing: LiveTiming, now: number): MatchClock {
  const elapsed = Math.max(0, now - startOf(timing));
  if (elapsed < HALF_MS) {
    const minute = Math.floor(elapsed / MINUTE) + 1;
    return { label: `${minute}'`, minute, halftime: false };
  }
  if (elapsed < HALF_MS + HALFTIME_MS) return { label: "HT", minute: null, halftime: true };
  const minute = Math.floor((elapsed - HALFTIME_MS) / MINUTE) + 1;
  if (minute > 90) return { label: "90+'", minute: 90, halftime: false };
  return { label: `${minute}'`, minute, halftime: false };
}

/**
 * The start time a goal in `minute` implies, given when it was seen. Null when
 * it says nothing reliable: the minutes around halftime, stoppage time, or a
 * start far from the scheduled kickoff.
 */
export function startFromEvent(
  minute: number,
  seenAt: number,
  kickoff: string,
  slackMs = 0,
): string | null {
  if (minute < 1 || (minute >= 45 && minute <= 46) || minute > 89) return null;
  // The clock read somewhere inside that minute.
  const played = (minute - 0.5) * MINUTE + (minute > 45 ? HALFTIME_MS : 0);
  const start = seenAt - played - slackMs;
  if (Math.abs(start - Date.parse(kickoff)) > 30 * MINUTE) return null;
  return new Date(start).toISOString();
}
