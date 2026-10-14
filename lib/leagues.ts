import { SPORT_LABEL, SPORTS, type Sport } from "@/lib/sport";

/**
 * The leagues the site covers: a conference's men's or women's soccer. The
 * nav's league menu lists these under a Men's and a Women's heading. Each sport
 * has one league today (every page lives under `/men` or `/women`), so adding a
 * conference starts here, and its pages and data come with it.
 */
export type League = {
  id: string;
  sport: Sport;
  /** Short name, as in "CCIW Men's Soccer". */
  name: string;
  fullName: string;
};

export const LEAGUES: League[] = [
  { id: "cciw", sport: "men", name: "CCIW", fullName: "College Conference of Illinois and Wisconsin" },
  { id: "cciw", sport: "women", name: "CCIW", fullName: "College Conference of Illinois and Wisconsin" },
];

export type LeagueGroup = {
  sport: Sport;
  label: string;
  leagues: League[];
};

/** One group per sport, in `SPORTS` order; a sport without leagues is left out. */
export function leagueGroups(leagues: League[] = LEAGUES): LeagueGroup[] {
  return SPORTS.map((sport) => ({
    sport,
    label: SPORT_LABEL[sport],
    leagues: leagues.filter((league) => league.sport === sport),
  })).filter((group) => group.leagues.length > 0);
}

/** The league of the page being shown. */
export function leagueFor(sport: Sport, leagues: League[] = LEAGUES): League {
  return leagues.find((league) => league.sport === sport) ?? LEAGUES[0];
}

/** "CCIW Men's Soccer" */
export function leagueLabel(league: League): string {
  return `${league.name} ${SPORT_LABEL[league.sport]}`;
}
