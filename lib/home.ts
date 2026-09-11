import { dayKey, TODAY_KEY } from "@/lib/data/season";
import {
  computeStandings,
  getAllMatches,
  getTopScorers,
  requireTeam,
  type ScorerLine,
} from "@/lib/selectors";
import type { Match, StandingsRow, Team } from "@/lib/types";

/**
 * One data shape behind all five home-page designs, so they can be compared
 * fairly: any difference a reader sees is a design difference, not a content
 * one. Everything here is derived through lib/selectors, never from raw data.
 */

export type StandingsLine = {
  row: StandingsRow;
  team: Team;
  rank: number;
};

export type HomeData = {
  /** The match in progress, if there is one. Drives every hero treatment. */
  live: Match | null;
  /** Whatever the hero shows when nothing is live: the next kickoff. */
  featured: Match | null;
  today: Match[];
  upcoming: Match[];
  recent: Match[];
  standings: StandingsLine[];
  scorers: ScorerLine[];
};

export function getHomeData(): HomeData {
  const all = getAllMatches();

  const today = all.filter((match) => dayKey(match.date) === TODAY_KEY);
  const live = all.find((match) => match.status === "live") ?? null;

  const upcoming = all
    .filter((match) => match.status === "scheduled" && dayKey(match.date) > TODAY_KEY)
    .slice(0, 6);

  // Newest first: the most recent result is the one worth leading with.
  const recent = all
    .filter((match) => match.status === "final")
    .slice(-6)
    .reverse();

  const standings: StandingsLine[] = computeStandings().map((row, index) => ({
    row,
    team: requireTeam(row.teamSlug),
    rank: index + 1,
  }));

  return {
    live,
    featured: live ?? today.find((match) => match.status === "scheduled") ?? upcoming[0] ?? null,
    today,
    upcoming,
    recent,
    standings,
    scorers: getTopScorers(5),
  };
}
