import Link from "next/link";
import { TeamBadge } from "@/components/TeamBadge";
import { ExpandableRows } from "@/components/ExpandableRows";
import { FormDots } from "@/components/FormDots";
import { played } from "@/lib/selectors";
import { recordFor } from "@/lib/standings";
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
            <span className="min-w-0 flex-1 truncate text-[0.82rem] font-bold text-ink">
              {line.team.name}
            </span>
            <FormDots form={line.row.form} />
            <span className="w-14 text-right text-[0.75rem] text-ink-muted tabular-nums">
              {played(record)} GP
            </span>
            <span className="w-8 text-right text-[0.9rem] font-black text-ink tabular-nums">
              {record.pts}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function ScorerRow({
  line,
  rank,
  bordered,
}: {
  line: HomeData["scorers"][number];
  rank: number;
  /** Always draw the divider, when something follows the row. */
  bordered: boolean;
}) {
  return (
    <div
      className={`bc-row flex items-center gap-3 border-b border-line px-4 ${bordered ? "" : "last:border-0"}`}
    >
      <span className="w-4 text-[0.75rem] font-black text-ink-faint tabular-nums">{rank}</span>
      <TeamBadge team={line.team} size="xs" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.82rem] font-bold text-ink">{line.player.name}</span>
        <span className="block text-[0.7rem] text-ink-faint">
          {line.player.stats.goals}G · {line.player.stats.assists}A
        </span>
      </span>
      <span className="text-[0.95rem] font-black text-accent tabular-nums">{line.points}</span>
    </div>
  );
}

/** With `initial`, only that many rows show and the rest sit behind "Show more". */
export function ScorersSnippet({
  scorers,
  initial,
}: {
  scorers: HomeData["scorers"];
  initial?: number;
}) {
  const split = initial !== undefined && scorers.length > initial ? initial : scorers.length;
  const rest = scorers.slice(split);

  return (
    <div className="bc-card bc-flush overflow-hidden">
      {scorers.slice(0, split).map((line, index) => (
        <ScorerRow key={line.player.id} line={line} rank={index + 1} bordered={rest.length > 0} />
      ))}
      {rest.length > 0 ? (
        <ExpandableRows>
          {rest.map((line, index) => (
            <ScorerRow key={line.player.id} line={line} rank={split + index + 1} bordered />
          ))}
        </ExpandableRows>
      ) : null}
    </div>
  );
}
