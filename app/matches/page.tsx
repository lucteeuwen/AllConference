import type { Metadata } from "next";
import { Lockup } from "@/components/broadcast/Lockup";
import { DateStrip, type DayChip } from "@/components/DateStrip";
import { EarlierMatches } from "@/components/EarlierMatches";
import { MatchFilterBar } from "@/components/MatchFilterBar";
import { MatchRow } from "@/components/broadcast/MatchRow";
import { EmptyState } from "@/components/EmptyState";
import { applyFilters, filtersToQuery, parseFilters } from "@/lib/filters";
import { formatChipLabel, formatDayLabel } from "@/lib/format";
import { SEASON_LABEL, dayKey, todayKey } from "@/lib/season";
import { getSeasonData } from "@/lib/season-data";
import { groupMatchesByDate, type DayGroup } from "@/lib/selectors";

export const metadata: Metadata = {
  title: "Matches",
};

/** Delay steps of the load cascade; rows past the first dozen share the last one. */
const CASCADE_MS = 55;
const CASCADE_STEPS = 12;

function cascade(index: number | undefined) {
  if (index === undefined) return {};
  return {
    className: "rise-in",
    style: { animationDelay: `${Math.min(index, CASCADE_STEPS) * CASCADE_MS}ms` },
  };
}

/** `startIndex` places the day in the load cascade; leave it off to skip the animation. */
function DaySection({ group, startIndex }: { group: DayGroup; startIndex?: number }) {
  return (
    <section>
      <div {...cascade(startIndex)}>
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 className="bc-label text-[0.78rem] text-ink">{formatDayLabel(group.key)}</h2>
          <span className="text-[0.72rem] text-ink-faint tabular-nums">
            {group.matches.length} {group.matches.length === 1 ? "match" : "matches"}
          </span>
        </div>
      </div>
      <div className="space-y-2.5">
        {group.matches.map((match, index) => (
          <div key={match.id} {...cascade(startIndex === undefined ? undefined : startIndex + 1 + index)}>
            <MatchRow match={match} />
          </div>
        ))}
      </div>
    </section>
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

  // A season that has run out of fixtures reads better newest first, with no
  // split to make. A pinned day is a single group either way.
  const pinnedToDay = filters.day !== null;
  const splitAtToday = !pinnedToDay && current.length > 0;

  const flatGroups = !splitAtToday && !pinnedToDay ? [...groups].reverse() : groups;

  const shown = splitAtToday
    ? (filters.showPast ? groups : current).reduce((total, group) => total + group.matches.length, 0)
    : visible.length;

  // Each day's place in the load cascade: heading plus rows of every day before it.
  const listed = splitAtToday ? current : flatGroups;
  const startIndexes = listed.map((_, index) =>
    listed.slice(0, index).reduce((total, group) => total + group.matches.length + 1, 0),
  );

  return (
    <>
      <div
        id="matches-sticky"
        className="sticky top-0 z-30 -mx-4 flow-root bg-ground px-4 pb-3 md:top-16 md:mx-0 md:px-0"
      >
        <Lockup title="Matches" subtitle={`${SEASON_LABEL} · CCIW Men's Soccer`}>
          <DateStrip
            chips={chips}
            allHref={`/matches${filtersToQuery({ ...filters, day: null })}`}
            activeDay={filters.day}
            today={today}
          />
        </Lockup>

        <div className="mt-3">
          <MatchFilterBar
            filters={filters}
            teams={data.conference}
            shown={shown}
            total={all.length}
          />
        </div>
      </div>

      <div className="pt-2 [overflow-anchor:none]">
        {groups.length === 0 ? (
          <EmptyState
            title="No matches match these filters"
            body="Try widening the date, switching back to all games, or clearing the team selection."
            actionLabel="Clear all filters"
            actionHref="/matches"
          />
        ) : splitAtToday ? (
          <div className="space-y-7">
            {pastCount > 0 ? (
              <EarlierMatches
                count={pastCount}
                open={filters.showPast}
                openHref={`/matches${filtersToQuery({ ...filters, showPast: true })}`}
                closeHref={`/matches${filtersToQuery({ ...filters, showPast: false })}`}
              >
                {past.map((group) => (
                  <DaySection key={group.key} group={group} />
                ))}
              </EarlierMatches>
            ) : null}
            {current.map((group, index) => (
              <DaySection key={group.key} group={group} startIndex={startIndexes[index]} />
            ))}
          </div>
        ) : (
          <div className="space-y-7">
            {flatGroups.map((group, index) => (
              <DaySection key={group.key} group={group} startIndex={startIndexes[index]} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
