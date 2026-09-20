"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TeamBadge } from "@/components/TeamBadge";
import { FormDots } from "@/components/FormDots";
import { SlidingSegments } from "@/components/SlidingSegments";
import { recordFor, sortEntries, type SortColumn, type SortKey } from "@/lib/standings";
import type { StandingsRow, StandingsSplit, Team } from "@/lib/types";

export type StandingsEntry = {
  row: StandingsRow;
  team: Team;
};

const splits: { value: StandingsSplit; label: string }[] = [
  { value: "all", label: "All" },
  { value: "home", label: "Home" },
  { value: "away", label: "Away" },
];

const columns: { key: SortColumn; label: string; title: string }[] = [
  { key: "pts", label: "PTS", title: "Points" },
  { key: "w", label: "W", title: "Won" },
  { key: "l", label: "L", title: "Lost" },
  { key: "d", label: "D", title: "Drawn" },
  { key: "gf", label: "GF", title: "Goals for" },
  { key: "ga", label: "GA", title: "Goals against" },
  { key: "gd", label: "+/-", title: "Goal difference" },
];

export function StandingsTable({
  entries,
  conferenceStarted,
}: {
  entries: StandingsEntry[];
  /** Decides what the All view shows; see `recordFor`. */
  conferenceStarted: boolean;
}) {
  const [split, setSplit] = useState<StandingsSplit>("all");
  // Standing is the order that decides the CCIW tournament field, so it is the default.
  const [sort, setSort] = useState<SortKey>("rank");

  // Conference rank is fixed by the table order, so it survives re-sorting.
  const ranked = useMemo(
    () => entries.map((entry, index) => ({ ...entry, rank: index + 1 })),
    [entries],
  );

  const rows = useMemo(
    () => sortEntries(ranked, sort, split, conferenceStarted),
    [ranked, sort, split, conferenceStarted],
  );

  return (
    <div className="bc-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-3">
        <SlidingSegments
          label="Standings split"
          value={split}
          onChange={setSplit}
          options={splits}
          ringed={false}
          itemClassName="px-4"
        />

        <label className="flex items-center gap-2 text-[0.78rem] text-ink-muted">
          Sort by
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="rounded-control border border-line bg-surface px-3 py-1.5 text-[0.78rem] font-semibold text-ink outline-none focus:border-accent"
          >
            <option value="rank">Standing</option>
            <option value="form">Form</option>
            {columns.map((column) => (
              <option key={column.key} value={column.key}>
                {column.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[0.85rem]">
          <thead>
            <tr className="bc-label text-left text-[0.65rem] text-ink-faint">
              <th scope="col" className="w-10 py-2.5 pl-4 font-semibold">#</th>
              <th scope="col" className="py-2.5 font-semibold">Team</th>
              <th scope="col" className="px-2 py-2.5 text-center font-semibold" title="Games played">GP</th>
              {columns.map((column) => (
                <th key={column.key} scope="col" className="px-2 py-2.5 text-center font-semibold">
                  <button
                    type="button"
                    onClick={() => setSort(column.key)}
                    title={`Sort by ${column.title}`}
                    className={`transition hover:text-accent ${
                      sort === column.key ? "text-accent" : ""
                    }`}
                  >
                    {column.label}
                  </button>
                </th>
              ))}
              <th scope="col" className="px-4 py-2.5 text-left font-semibold">
                <button
                  type="button"
                  onClick={() => setSort("form")}
                  title="Sort by form"
                  className={`transition hover:text-accent ${sort === "form" ? "text-accent" : ""}`}
                >
                  Form
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ row, team, rank }) => {
              const record = recordFor(row, split, conferenceStarted);
              const gp = record.w + record.l + record.d;
              const gd = record.gf - record.ga;

              return (
                <tr key={team.slug} className="border-t border-line/80 hover:bg-ground/60">
                  <td className="bc-row pl-4 text-[0.78rem] font-semibold text-ink-faint tabular-nums">
                    {rank}
                  </td>
                  <td className="bc-row">
                    <Link href={`/teams/${team.slug}`} className="flex items-center gap-2.5 group">
                      <TeamBadge team={team} size="sm" />
                      <span className="font-semibold text-ink group-hover:text-accent">
                        {team.name}
                      </span>
                    </Link>
                  </td>
                  <td className="bc-row px-2 text-center tabular-nums text-ink-muted">{gp}</td>
                  <td className="bc-row px-2 text-center font-bold tabular-nums text-ink">{record.pts}</td>
                  <td className="bc-row px-2 text-center tabular-nums text-ink-muted">{record.w}</td>
                  <td className="bc-row px-2 text-center tabular-nums text-ink-muted">{record.l}</td>
                  <td className="bc-row px-2 text-center tabular-nums text-ink-muted">{record.d}</td>
                  <td className="bc-row px-2 text-center tabular-nums text-ink-muted">{record.gf}</td>
                  <td className="bc-row px-2 text-center tabular-nums text-ink-muted">{record.ga}</td>
                  <td className="bc-row px-2 text-center tabular-nums text-ink-muted">
                    {gd > 0 ? `+${gd}` : gd}
                  </td>
                  <td className="bc-row px-4">
                    <FormDots form={row.form} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
