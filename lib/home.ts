import { dayKey, todayKey } from "@/lib/season";
import { getSeasonData, withDetails } from "@/lib/season-data";
import { pickHeroMatch } from "@/lib/hero";
import { getTopScorers, standingsLines, type ScorerLine, type StandingsLine } from "@/lib/selectors";
import type { Match } from "@/lib/types";

export type { StandingsLine };

export type HomeData = {
  /** Only set from 15 minutes before a kickoff until 15 minutes after full time. */
  hero: Match | null;
  /** Server clock at render, so the browser's first paint agrees with it. */
  renderedAt: number;
  /** The whole season in date order; the scoreboard rail picks its own window. */
  matches: Match[];
  /** The next scheduled matches, today's included. */
  upcoming: Match[];
  standings: StandingsLine[];
  scorers: ScorerLine[];
};

/** `at` overrides the clock for previews; defaults to now. */
export async function getHomeData(at?: number): Promise<HomeData> {
  const now = at ?? Date.now();
  const data = await getSeasonData();
  const all = data.matches;
  const today = todayKey(0, new Date(now));

  const upcoming = all
    .filter((match) => match.status === "scheduled" && dayKey(match.date) >= today)
    .slice(0, 6);

  const hero = pickHeroMatch(all, now);

  return {
    hero: hero ? await withDetails(hero) : null,
    renderedAt: now,
    matches: all,
    upcoming,
    standings: standingsLines(data),
    scorers: getTopScorers(data, 5),
  };
}
