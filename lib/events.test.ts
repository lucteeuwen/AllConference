import { describe, expect, it } from "vitest";
import { isCard, isGoal, isMarker, isScoringOrCard } from "@/lib/events";
import type { MatchEventType } from "@/lib/types";

const all: MatchEventType[] = ["goal", "own-goal", "penalty", "yellow", "red", "sub", "shot", "foul", "corner", "freekick", "period"];

describe("event kinds", () => {
  it("separates what decides a match from the colour around it", () => {
    expect(all.filter((type) => isScoringOrCard({ type }))).toEqual(["goal", "own-goal", "penalty", "yellow", "red"]);
  });

  it("knows goals, cards and markers apart", () => {
    expect(all.filter(isGoal)).toEqual(["goal", "own-goal", "penalty"]);
    expect(all.filter(isCard)).toEqual(["yellow", "red"]);
    expect(all.filter((type) => isMarker({ type }))).toEqual(["period"]);
  });
});
