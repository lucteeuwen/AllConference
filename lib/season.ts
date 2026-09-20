/**
 * Season identity. The clock helpers that used to live here moved to
 * `lib/format.ts`, where every one of them takes the zone to read in: a
 * kickoff is a UTC instant, and which day it falls on depends on who is asking.
 */

export const SEASON = Number(process.env.NEXT_PUBLIC_SEASON ?? 2026);
export const SEASON_LABEL = `${SEASON} Season`;
