"use client";

import { useCallback, useMemo } from "react";
import { DateStrip } from "@/components/DateStrip";
import { EarlierMatches } from "@/components/EarlierMatches";
import { EmptyState } from "@/components/EmptyState";
import { Lockup } from "@/components/broadcast/Lockup";
import { MatchFilterBar } from "@/components/MatchFilterBar";
import { MatchRow } from "@/components/broadcast/MatchRow";
import { applyFilters, filtersToQuery, type MatchFilters } from "@/lib/filters";
import { formatDayLabel, matchDayKey } from "@/lib/format";
import { SEASON_LABEL } from "@/lib/season";
import { groupMatchesByDate, type DayGroup } from "@/lib/selectors";
import { useViewerDay } from "@/lib/use-viewer-day";
import type { Match, Team } from "@/lib/types";

/**
 * The whole match list, regrouped in the reader's own time zone.
 *
 * Grouping has to happen here rather than on the server because an evening
 * kickoff in Illinois is the next morning in Europe: the day a match belongs
 * to is a property of who is looking. The server still renders this component
 * in the conference's zone, so the first paint and anything that does not run
 * JavaScript get a complete, correct list with working links; the browser
 * regroups once it knows better.
 */

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
function DaySection({
  group,
  today,
  startIndex,
}: {
  group: DayGroup;
  today: string;
  startIndex?: number;
}) {
  return (
    <section>
      <div {...cascade(startIndex)}>
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 className="bc-label text-[0.78rem] text-ink">{formatDayLabel(group.key, today)}</h2>
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

export function MatchesView({
  matches,
  filters,
  conference,
  renderedAt,
}: {
  matches: Match[];
  filters: MatchFilters;
  conference: Team[];
  renderedAt: number;
}) {
  const { tz, today } = useViewerDay(renderedAt);
  const dayOf = useCallback((match: Match) => matchDayKey(match, tz), [tz]);

  const visible = useMemo(() => applyFilters(matches, filters, dayOf), [matches, filters, dayOf]);
  // The rail always shows every match day, so clearing a narrow filter is one tap.
  const days = useMemo(
    () => groupMatchesByDate(matches, dayOf).map((group) => ({ key: group.key, count: group.matches.length })),
    [matches, dayOf],
  );
  const groups = useMemo(() => groupMatchesByDate(visible, dayOf), [visible, dayOf]);

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
            days={days}
            filters={filters}
            allHref={`/matches${filtersToQuery({ ...filters, day: null })}`}
            activeDay={filters.day}
            today={today}
          />
        </Lockup>

        <div className="mt-3">
          <MatchFilterBar
            filters={filters}
            teams={conference}
            shown={shown}
            total={matches.length}
          />
        </div>
      </div>

      <div className="pt-2 [overflow-anchor:none]">
        {groups.length === 0 ? (
          <EmptyState
            title={pinnedToDay ? "No matches on this day" : "No matches match these filters"}
            body={
              pinnedToDay
                ? "Days are shown in your own time zone, so a link shared from elsewhere can land a day either side of the games it meant."
                : "Try widening the date, switching back to all games, or clearing the team selection."
            }
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
                  <DaySection key={group.key} group={group} today={today} />
                ))}
              </EarlierMatches>
            ) : null}
            {current.map((group, index) => (
              <DaySection key={group.key} group={group} today={today} startIndex={startIndexes[index]} />
            ))}
          </div>
        ) : (
          <div className="space-y-7">
            {flatGroups.map((group, index) => (
              <DaySection key={group.key} group={group} today={today} startIndex={startIndexes[index]} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
