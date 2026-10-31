import type { MatchEvent, MatchEventType } from "@/lib/types";

/**
 * Which timeline entries are the ones that decide a match and a season's
 * numbers: goals and cards. Everything else the live feed adds (substitutions,
 * shots, fouls, set pieces, half markers) is colour for the timeline alone.
 */

const GOAL_TYPES: MatchEventType[] = ["goal", "own-goal", "penalty"];
const CARD_TYPES: MatchEventType[] = ["yellow", "red"];

export function isGoal(type: MatchEventType): boolean {
  return GOAL_TYPES.includes(type);
}

export function isCard(type: MatchEventType): boolean {
  return CARD_TYPES.includes(type);
}

/** A goal, an own goal, a penalty or a card. */
export function isScoringOrCard(event: Pick<MatchEvent, "type">): boolean {
  return isGoal(event.type) || isCard(event.type);
}

/** Half-time and similar markers, drawn across the timeline rather than for a side. */
export function isMarker(event: Pick<MatchEvent, "type">): boolean {
  return event.type === "period";
}
