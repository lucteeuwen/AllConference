import type { Match } from "@/lib/types";

/**
 * Match-list filters. They round-trip through the URL so any filtered view can
 * be linked, shared and restored on reload.
 */

export type CompetitionFilter = "all" | "conference" | "non-conference";

export type MatchFilters = {
  /**
   * A YYYY-MM-DD day key, or null for the whole season. The key is read in the
   * reader's own zone, so a shared link can land on a different day for
   * someone far enough away -- the list says so rather than looking empty.
   */
  day: string | null;
  competition: CompetitionFilter;
  teamSlugs: string[];
  /**
   * Disclosure rather than a filter: the list starts at today, and this reveals
   * the days before it. Carried in the URL so it survives a filter change.
   */
  showPast: boolean;
};

export const emptyFilters: MatchFilters = {
  day: null,
  competition: "all",
  teamSlugs: [],
  showPast: false,
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function list(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const flat = Array.isArray(value) ? value : [value];
  return flat.flatMap((entry) => entry.split(",")).filter(Boolean);
}

export function parseFilters(params: RawSearchParams): MatchFilters {
  const competition = single(params.competition);

  return {
    day: single(params.day) ?? null,
    competition:
      competition === "conference" || competition === "non-conference" ? competition : "all",
    teamSlugs: list(params.teams),
    showPast: single(params.past) === "1",
  };
}

export function filtersToQuery(filters: MatchFilters): string {
  const params = new URLSearchParams();
  if (filters.day) params.set("day", filters.day);
  if (filters.competition !== "all") params.set("competition", filters.competition);
  if (filters.teamSlugs.length > 0) params.set("teams", filters.teamSlugs.join(","));
  if (filters.showPast) params.set("past", "1");
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** `showPast` is deliberately excluded: it reveals rows, it does not remove any. */
export function activeFilterCount(filters: MatchFilters): number {
  return (
    (filters.day ? 1 : 0) +
    (filters.competition !== "all" ? 1 : 0) +
    filters.teamSlugs.length
  );
}

/** `dayOf` is injected because a match's day depends on the reader's zone. */
export function applyFilters(
  list: Match[],
  filters: MatchFilters,
  dayOf: (match: Match) => string,
): Match[] {
  return list.filter((match) => {
    if (filters.day && dayOf(match) !== filters.day) return false;

    // The CCIW tournament counts as conference play for filtering.
    const conference = match.isConference || ["quarterfinal", "semifinal", "final"].includes(match.stage);
    if (filters.competition === "conference" && !conference) return false;
    if (filters.competition === "non-conference" && conference) return false;

    if (
      filters.teamSlugs.length > 0 &&
      !filters.teamSlugs.includes(match.home.teamSlug ?? "") &&
      !filters.teamSlugs.includes(match.away.teamSlug ?? "")
    ) {
      return false;
    }

    return true;
  });
}
