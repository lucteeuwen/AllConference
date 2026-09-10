"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { TeamBadge } from "@/components/TeamBadge";
import type { Team } from "@/lib/types";

export type TeamOption = {
  team: Team;
  href: string;
  selected: boolean;
};

type Props = {
  options: TeamOption[];
  selectedCount: number;
  clearHref: string;
};

/** Multi-select built from links, so each toggle is a normal navigation. */
export function TeamFilter({ options, selectedCount, clearHref }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${
          selectedCount > 0
            ? "border-accent bg-accent-soft text-accent"
            : "border-line bg-surface text-ink-muted hover:text-ink"
        }`}
      >
        Teams
        {selectedCount > 0 ? (
          <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold text-white tabular-nums">
            {selectedCount}
          </span>
        ) : null}
        <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div className="absolute top-full left-0 z-30 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_20px_40px_-20px_rgba(16,24,40,0.4)]">
          <div className="max-h-72 overflow-y-auto py-1">
            {options.map((option) => (
              <Link
                key={option.team.slug}
                href={option.href}
                scroll={false}
                className="flex items-center gap-2.5 px-3 py-2 text-sm transition hover:bg-ground"
              >
                <span
                  className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                    option.selected ? "border-accent bg-accent text-white" : "border-line"
                  }`}
                >
                  {option.selected ? (
                    <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M2 6.2l2.6 2.6L10 3.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </span>
                <TeamBadge team={option.team} size="xs" />
                <span className="truncate font-medium text-ink">{option.team.name}</span>
              </Link>
            ))}
          </div>
          {selectedCount > 0 ? (
            <Link
              href={clearHref}
              scroll={false}
              className="block border-t border-line px-3 py-2 text-center text-[13px] font-semibold text-accent hover:bg-ground"
            >
              Clear teams
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
