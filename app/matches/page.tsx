import type { Metadata } from "next";
import Link from "next/link";
import { Lockup } from "@/components/broadcast/Lockup";
import { DateStrip, type DayChip } from "@/components/DateStrip";
import { MatchFilterBar } from "@/components/MatchFilterBar";
import { MatchRow } from "@/components/broadcast/MatchRow";
import { EmptyState } from "@/components/EmptyState";
import { applyFilters, filtersToQuery, parseFilters, type MatchFilters } from "@/lib/filters";
import { formatChipLabel, formatDayLabel } from "@/lib/format";
import { SEASON_LABEL, dayKey, todayKey } from "@/lib/season";
import { getSeasonData } from "@/lib/season-data";
import { groupMatchesByDate, type DayGroup } from "@/lib/selectors";

export const metadata: Metadata = {
  title: "Matches",
};

function DaySection({ group, anchor }: { group: DayGroup; anchor?: boolean }) {
  return (
    <section id={anchor ? "today" : undefined} className={anchor ? "scroll-mt-6" : undefined}>
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="bc-label text-[0.78rem] text-ink">{formatDayLabel(group.key)}</h2>
        <span className="text-[0.72rem] text-ink-faint tabular-nums">
          {group.matches.length} {group.matches.length === 1 ? "match" : "matches"}
        </span>
      </div>
      <div className="space-y-2.5">
        {group.matches.map((match) => (
          <MatchRow key={match.id} match={match} />
        ))}
      </div>
    </section>
  );
}

/**
 * Sits on the boundary between finished days and the days ahead, which is both
 * where the list starts when collapsed and where the reader is looking once it
 * expands. The `#today` hash keeps today's matches in place either way.
 */
function EarlierToggle({ filters, count }: { filters: MatchFilters; count: number }) {
  const open = filters.showPast;
  const href = `/matches${filtersToQuery({ ...filters, showPast: !open })}#today`;

  return (
    <div className="relative py-1">
      <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-line" />
      <div className="relative flex justify-center">
        <Link
          href={href}
          className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-1.5 text-[13px] font-semibold text-ink-muted transition hover:border-accent hover:text-accent"
        >
          <svg
            viewBox="0 0 16 16"
            className={`size-3 transition ${open ? "" : "rotate-180"}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {open ? "Hide earlier matches" : `Show ${count} earlier ${count === 1 ? "match" : "matches"}`}
        </Link>
      </div>
    </div>
  );
}

export default async function MatchesPage(props: PageProps<"/matches">) {
  const filters = parseFilters(await props.searchParams);
  const data = await getSeasonData();
  const all = data.matches;
  const today = todayKey();
  const visible = applyFilters(all, filters, dayKey);

  // The rail always shows every match day, so clearing a narrow filter is one tap.
  const chips: DayChip[] = groupMatchesByDate(all).map((group) => {
    const label = formatChipLabel(group.key);
    return {
      key: group.key,
      href: `/matches${filtersToQuery({ ...filters, day: group.key })}`,
      top: label.top,
      bottom: label.bottom,
      count: group.matches.length,
      isToday: group.key === today,
    };
  });

  const groups = groupMatchesByDate(visible);
  const past = groups.filter((group) => group.key < today);
  const current = groups.filter((group) => group.key >= today);
  const pastCount = past.reduce((total, group) => total + group.matches.length, 0);

  // A results-only view is entirely behind us, and so is a season that has run
  // out of fixtures. Both read better newest first, with no split to make.
  const resultsOnly = filters.status === "results";
  const pinnedToDay = filters.day !== null;
  const splitAtToday = !resultsOnly && !pinnedToDay && current.length > 0;

  const flatGroups =
    !splitAtToday && !pinnedToDay && (resultsOnly || current.length === 0)
      ? [...groups].reverse()
      : groups;

  const shown = splitAtToday
    ? (filters.showPast ? groups : current).reduce((total, group) => total + group.matches.length, 0)
    : visible.length;

  return (
    <>
      <Lockup title="Matches" subtitle={`${SEASON_LABEL} · CCIW Men's Soccer`}>
        <DateStrip
          chips={chips}
          allHref={`/matches${filtersToQuery({ ...filters, day: null })}`}
          activeDay={filters.day}
          today={today}
        />
      </Lockup>

      <div className="mt-6">
        <MatchFilterBar
          filters={filters}
          teams={data.conference}
          shown={shown}
          total={all.length}
        />
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="No matches match these filters"
          body="Try widening the date, switching back to all games, or clearing the team selection."
          actionLabel="Clear all filters"
          actionHref="/matches"
        />
      ) : splitAtToday ? (
        <div className="space-y-7">
          {filters.showPast ? past.map((group) => <DaySection key={group.key} group={group} />) : null}
          {pastCount > 0 ? <EarlierToggle filters={filters} count={pastCount} /> : null}
          {current.map((group, index) => (
            <DaySection key={group.key} group={group} anchor={index === 0} />
          ))}
        </div>
      ) : (
        <div className="space-y-7">
          {flatGroups.map((group) => (
            <DaySection key={group.key} group={group} />
          ))}
        </div>
      )}
    </>
  );
}
