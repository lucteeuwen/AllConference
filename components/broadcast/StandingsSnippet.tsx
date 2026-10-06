import type { ReactNode } from "react";
import Link from "next/link";
import { RankedTag } from "@/components/RankedTag";
import { TeamBadge } from "@/components/TeamBadge";
import { ExpandableRows } from "@/components/ExpandableRows";
import { FormDots } from "@/components/FormDots";
import { playerHref } from "@/lib/players";
import { played, type ScorerStat } from "@/lib/selectors";
import { pointsFor, recordFor } from "@/lib/standings";
import type { HomeData } from "@/lib/home";

/**
 * The home page's compact standings. Its numbers come from the same `recordFor`
 * call as the Standings page's default view: every game played so far until the
 * first conference match, the conference record after.
 */
export function StandingsSnippet({
  standings,
  conferenceStarted,
  limit = 6,
}: {
  standings: HomeData["standings"];
  conferenceStarted: boolean;
  limit?: number;
}) {
  return (
    <div className="bc-card bc-flush overflow-hidden">
      {standings.slice(0, limit).map((line) => {
        const record = recordFor(line.row, "all", conferenceStarted);
        return (
          <Link
            key={line.team.slug}
            href={`/teams/${line.team.slug}`}
            className="bc-row flex items-center gap-3 border-b border-line px-4 transition last:border-0 hover:bg-ground"
          >
            <span className="w-4 text-[0.75rem] font-black text-ink-faint tabular-nums">
              {line.rank}
            </span>
            <TeamBadge team={line.team} size="xs" />
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="truncate text-[0.82rem] font-bold text-ink">{line.team.name}</span>
              <RankedTag team={line.team} />
            </span>
            <FormDots form={line.row.form} />
            <span className="w-14 text-right text-[0.75rem] text-ink-muted tabular-nums">
              {played(record)} GP
            </span>
            <span className="w-8 text-right text-[0.9rem] font-black text-ink tabular-nums">
              {pointsFor(line.row, "all", conferenceStarted)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function StatColumn({
  value,
  label,
  active,
}: {
  value: number;
  label: string;
  /** The stat the list is ranked on. */
  active: boolean;
}) {
  return (
    <span className="w-8 text-center">
      <span
        className={`block text-[0.95rem] tabular-nums ${active ? "font-black text-accent" : "font-bold text-ink-muted"}`}
      >
        {value}
      </span>
      <span className="bc-label block text-[0.6rem] text-ink-faint">{label}</span>
    </span>
  );
}

function ScorerRow({
  line,
  rank,
  stat,
  bordered,
}: {
  line: HomeData["scorers"][number];
  rank: number;
  stat: ScorerStat;
  /** Always draw the divider, when something follows the row. */
  bordered: boolean;
}) {
  return (
    <Link
      href={playerHref(line.player)}
      className={`bc-row flex items-center gap-3 border-b border-line px-4 transition hover:bg-ground ${bordered ? "" : "last:border-0"}`}
    >
      <span className="w-4 text-[0.75rem] font-black text-ink-faint tabular-nums">{rank}</span>
      <TeamBadge team={line.team} size="xs" />
      <span className="min-w-0 flex-1 truncate text-[0.82rem] font-bold text-ink">
        {line.player.name}
      </span>
      <StatColumn value={line.player.stats.goals} label="G" active={stat === "goals"} />
      <StatColumn value={line.player.stats.assists} label="A" active={stat === "assists"} />
    </Link>
  );
}

/**
 * With `initial`, only that many rows show and the rest sit behind "Show more".
 * `stat` is what the list is ranked on, and is picked out in accent; `header`
 * sits in a bar above the rows.
 */
export function ScorersSnippet({
  scorers,
  initial,
  stat = "goals",
  header,
}: {
  scorers: HomeData["scorers"];
  initial?: number;
  stat?: ScorerStat;
  header?: ReactNode;
}) {
  const split = initial !== undefined && scorers.length > initial ? initial : scorers.length;
  const rest = scorers.slice(split);

  return (
    <div className="bc-card bc-flush overflow-hidden">
      {header ? <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">{header}</div> : null}
      {scorers.slice(0, split).map((line, index) => (
        <ScorerRow
          key={line.player.id}
          line={line}
          rank={index + 1}
          stat={stat}
          bordered={rest.length > 0}
        />
      ))}
      {rest.length > 0 ? (
        // Keyed on the stat so a fresh ranking starts collapsed rather than inheriting "Show more".
        <ExpandableRows key={stat}>
          {rest.map((line, index) => (
            <ScorerRow key={line.player.id} line={line} rank={split + index + 1} stat={stat} bordered />
          ))}
        </ExpandableRows>
      ) : null}
    </div>
  );
}
