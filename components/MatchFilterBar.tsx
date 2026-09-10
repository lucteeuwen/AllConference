import Link from "next/link";
import { TeamFilter, type TeamOption } from "@/components/TeamFilter";
import {
  activeFilterCount,
  filtersToQuery,
  type CompetitionFilter,
  type MatchFilters,
  type StatusFilter,
} from "@/lib/filters";
import type { Team } from "@/lib/types";

const BASE = "/matches";

function href(filters: MatchFilters): string {
  return `${BASE}${filtersToQuery(filters)}`;
}

const statuses: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "results", label: "Results" },
  { value: "upcoming", label: "Upcoming" },
];

const competitions: { value: CompetitionFilter; label: string }[] = [
  { value: "all", label: "All games" },
  { value: "conference", label: "Conference" },
  { value: "non-conference", label: "Non-conference" },
];

function Pill({ active, children, target }: { active: boolean; children: string; target: string }) {
  return (
    <Link
      href={target}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
        active ? "bg-accent text-white shadow-sm" : "text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

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
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-full bg-ground p-1 ring-1 ring-line">
        {statuses.map((option) => (
          <Pill
            key={option.value}
            active={filters.status === option.value}
            target={href({ ...filters, status: option.value })}
          >
            {option.label}
          </Pill>
        ))}
      </div>

      <div className="flex gap-1 rounded-full bg-ground p-1 ring-1 ring-line">
        {competitions.map((option) => (
          <Pill
            key={option.value}
            active={filters.competition === option.value}
            target={href({ ...filters, competition: option.value })}
          >
            {option.label}
          </Pill>
        ))}
      </div>

      <TeamFilter
        options={teamOptions}
        selectedCount={filters.teamSlugs.length}
        clearHref={href({ ...filters, teamSlugs: [] })}
      />

      <span className="ml-auto flex items-center gap-3 text-[13px] text-ink-muted">
        <span className="tabular-nums">
          {shown} of {total} matches
        </span>
        {active > 0 ? (
          <Link
            href={BASE}
            scroll={false}
            className="rounded-full border border-line px-3 py-1.5 text-[13px] font-semibold text-accent transition hover:border-accent"
          >
            Clear all
          </Link>
        ) : null}
      </span>
    </div>
  );
}
