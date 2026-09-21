import { getSeasonData, withDetails } from "@/lib/season-data";
import { pickHeroMatch } from "@/lib/hero";
import { SCHEDULED_END_MS } from "@/lib/live";
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

  // An instant, not a day key: this page is cached for every reader at once,
  // so it cannot use anyone's calendar. A match drops off the list once it has
  // had time to finish, rather than lingering until some particular midnight.
  const upcoming = all
    .filter((match) => match.status === "scheduled" && Date.parse(match.date) >= now - SCHEDULED_END_MS)
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
