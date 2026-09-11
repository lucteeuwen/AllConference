"use client";

import Link from "next/link";
import { useRef } from "react";
import { TeamBadge } from "@/components/TeamBadge";
import type { Team } from "@/lib/types";

export type RailTile = {
  id: string;
  /** "FINAL", "58'", or a kickoff time. */
  status: string;
  live: boolean;
  note: string;
  home: { team: Team; score: number | null; record: string };
  away: { team: Team; score: number | null; record: string };
  winner: "home" | "away" | null;
};

/**
 * The compact horizontal strip of games from the reference video: one tile per
 * match, status on top, a row per team, and the winner's score in a filled chip.
 */
export function ScoreboardRail({ tiles }: { tiles: RailTile[] }) {
  const rail = useRef<HTMLDivElement>(null);

  const page = (direction: 1 | -1) => {
    const node = rail.current;
    if (!node) return;
    node.scrollBy({ left: direction * node.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[13px] font-black tracking-[0.12em] text-ink uppercase">
          <svg viewBox="0 0 24 24" className="size-4 text-accent" fill="currentColor">
            <path d="M13 2L4.5 13.5H11l-1 8.5 8.5-11.5H12z" />
          </svg>
          Scoreboard
        </h2>
        <div className="flex gap-1.5">
          {([-1, 1] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              onClick={() => page(direction)}
              aria-label={direction === -1 ? "Scroll back" : "Scroll forward"}
              className="flex size-7 items-center justify-center rounded-full border border-line bg-surface text-ink-muted transition hover:border-accent hover:text-accent"
            >
              <svg
                viewBox="0 0 16 16"
                className={`size-3 ${direction === -1 ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <div ref={rail} className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 md:mx-0 md:px-0">
        {tiles.map((tile, index) => (
          <Link
            key={tile.id}
            href={`/matches/${tile.id}`}
            style={{ animationDelay: `${index * 55}ms` }}
            className="rise-in w-[188px] shrink-0 rounded-xl border border-line bg-surface p-3 transition hover:border-accent/50"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span
                className={`flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase ${
                  tile.live ? "text-live" : "text-ink-faint"
                }`}
              >
                {tile.live ? <span className="live-dot size-1.5 rounded-full bg-live" /> : null}
                {tile.status}
              </span>
              <span className="truncate text-[10px] font-semibold text-ink-faint uppercase">
                {tile.note}
              </span>
            </div>

            {(["home", "away"] as const).map((side) => {
              const entry = tile[side];
              const won = tile.winner === side;
              return (
                <div key={side} className="flex items-center gap-2 py-1">
                  <TeamBadge team={entry.team} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-bold text-ink">
                      {entry.team.name}
                    </span>
                    <span className="block truncate text-[10px] text-ink-faint tabular-nums">
                      {entry.record}
                    </span>
                  </span>
                  <span
                    className={`min-w-7 rounded-md px-1.5 py-0.5 text-center text-[13px] font-black tabular-nums ${
                      won ? "bg-navy text-white" : "text-ink-muted"
                    }`}
                  >
                    {entry.score ?? "–"}
                  </span>
                </div>
              );
            })}
          </Link>
        ))}
      </div>
    </div>
  );
}
