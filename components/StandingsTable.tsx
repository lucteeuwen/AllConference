"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TeamBadge } from "@/components/TeamBadge";
import { FormDots } from "@/components/FormDots";
import type { RecordLine, StandingsRow, StandingsSplit, Team } from "@/lib/types";

export type StandingsEntry = {
  row: StandingsRow;
  team: Team;
};

type SortKey = "rank" | "pts" | "w" | "l" | "d" | "gf" | "ga" | "gd";

const splits: { value: StandingsSplit; label: string }[] = [
  { value: "all", label: "All" },
  { value: "home", label: "Home" },
  { value: "away", label: "Away" },
];

const columns: { key: SortKey; label: string; title: string }[] = [
  { key: "pts", label: "PTS", title: "Points" },
  { key: "w", label: "W", title: "Won" },
  { key: "l", label: "L", title: "Lost" },
  { key: "d", label: "D", title: "Drawn" },
  { key: "gf", label: "GF", title: "Goals for" },
  { key: "ga", label: "GA", title: "Goals against" },
  { key: "gd", label: "+/-", title: "Goal difference" },
];

function pick(row: StandingsRow, split: StandingsSplit): RecordLine {
  return split === "home" ? row.home : split === "away" ? row.away : row.conference;
}

function value(record: RecordLine, key: SortKey): number {
  switch (key) {
    case "pts":
      return record.pts;
    case "w":
      return record.w;
    case "l":
      return record.l;
    case "d":
      return record.d;
    case "gf":
      return record.gf;
    case "ga":
      return record.ga;
    case "gd":
      return record.gf - record.ga;
    default:
      return 0;
  }
}

export function StandingsTable({ entries }: { entries: StandingsEntry[] }) {
  const [split, setSplit] = useState<StandingsSplit>("all");
  const [sort, setSort] = useState<SortKey>("rank");

  // Conference rank is fixed by the table order, so it survives re-sorting.
  const ranked = useMemo(
    () => entries.map((entry, index) => ({ ...entry, rank: index + 1 })),
    [entries],
  );

  const rows = useMemo(() => {
    if (sort === "rank") return ranked;
    return [...ranked].sort((a, b) => {
      const diff = value(pick(b.row, split), sort) - value(pick(a.row, split), sort);
      // Losses read best ascending; everything else descending.
      return sort === "l" ? -diff || a.rank - b.rank : diff || a.rank - b.rank;
    });
  }, [ranked, sort, split]);

  return (
    <div className="rounded-card border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-16px_rgba(16,24,40,0.24)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-3">
        <div role="group" aria-label="Standings split" className="flex gap-1 rounded-full bg-ground p-1">
          {splits.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSplit(option.value)}
              aria-pressed={split === option.value}
              className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${
                split === option.value
                  ? "bg-accent text-white shadow-sm"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-[13px] text-ink-muted">
          Sort by
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink outline-none focus:border-accent"
          >
            <option value="rank">Standing</option>
            {columns.map((column) => (
              <option key={column.key} value={column.key}>
                {column.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
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
              <th scope="col" className="px-4 py-2.5 text-left font-semibold">Form</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ row, team, rank }) => {
              const record = pick(row, split);
              const gp = record.w + record.l + record.d;
              const gd = record.gf - record.ga;

              return (
                <tr key={team.slug} className="border-t border-line/80 hover:bg-ground/60">
                  <td className="py-3 pl-4 text-[13px] font-semibold text-ink-faint tabular-nums">
                    {rank}
                  </td>
                  <td className="py-3">
                    <Link href={`/teams/${team.slug}`} className="flex items-center gap-2.5 group">
                      <TeamBadge team={team} size="sm" />
                      <span className="font-semibold text-ink group-hover:text-accent">
                        {team.name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-2 py-3 text-center tabular-nums text-ink-muted">{gp}</td>
                  <td className="px-2 py-3 text-center font-bold tabular-nums text-ink">{record.pts}</td>
                  <td className="px-2 py-3 text-center tabular-nums text-ink-muted">{record.w}</td>
                  <td className="px-2 py-3 text-center tabular-nums text-ink-muted">{record.l}</td>
                  <td className="px-2 py-3 text-center tabular-nums text-ink-muted">{record.d}</td>
                  <td className="px-2 py-3 text-center tabular-nums text-ink-muted">{record.gf}</td>
                  <td className="px-2 py-3 text-center tabular-nums text-ink-muted">{record.ga}</td>
                  <td className="px-2 py-3 text-center tabular-nums text-ink-muted">
                    {gd > 0 ? `+${gd}` : gd}
                  </td>
                  <td className="px-4 py-3">
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
