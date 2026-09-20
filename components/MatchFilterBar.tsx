import Link from "next/link";
import { SlidingSegments } from "@/components/SlidingSegments";
import { TeamFilter, type TeamOption } from "@/components/TeamFilter";
import {
  activeFilterCount,
  filtersToQuery,
  type CompetitionFilter,
  type MatchFilters,
} from "@/lib/filters";
import type { Team } from "@/lib/types";

const BASE = "/matches";

function href(filters: MatchFilters): string {
  return `${BASE}${filtersToQuery(filters)}`;
}

const competitions: { value: CompetitionFilter; label: string }[] = [
  { value: "all", label: "All games" },
  { value: "conference", label: "Conference" },
  { value: "non-conference", label: "Non-conference" },
];

type Props = {
  filters: MatchFilters;
  teams: Team[];
  shown: number;
  total: number;
};

export function MatchFilterBar({ filters, teams, shown, total }: Props) {
  const active = activeFilterCount(filters);

  const teamOptions: TeamOption[] = teams.map((team) => {
    const selected = filters.teamSlugs.includes(team.slug);
    const teamSlugs = selected
      ? filters.teamSlugs.filter((slug) => slug !== team.slug)
      : [...filters.teamSlugs, team.slug];
    return { team, selected, href: href({ ...filters, teamSlugs }) };
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SlidingSegments
        label="Competition"
        value={filters.competition}
        options={competitions.map((option) => ({
          ...option,
          href: href({ ...filters, competition: option.value }),
        }))}
      />

      <TeamFilter
        options={teamOptions}
        selectedCount={filters.teamSlugs.length}
        clearHref={href({ ...filters, teamSlugs: [] })}
      />

      <span className="ml-auto flex items-center gap-3 text-[0.78rem] text-ink-muted">
        <span className="tabular-nums">
          {shown} of {total} matches
        </span>
        {active > 0 ? (
          <Link
            href={BASE}
            scroll={false}
            className="rounded-control border border-line px-3 py-1.5 text-[0.78rem] font-semibold text-accent transition hover:border-accent"
          >
            Clear all
          </Link>
        ) : null}
      </span>
    </div>
  );
}
