"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export type DayChip = {
  key: string;
  href: string;
  top: string;
  bottom: string;
  count: number;
  isToday: boolean;
};

type Props = {
  chips: DayChip[];
  allHref: string;
  activeDay: string | null;
  /** Day key the strip opens on when nothing is selected. */
  today: string;
};

/** Matches the flex row's `gap-2`. */
const GAP_PX = 8;

/**
 * Horizontal date rail. Labels arrive already formatted from the server so the
 * markup matches on hydration; the only client-side work is positioning the
 * scroll on mount. "All" stays pinned to the left edge while the day chips
 * scroll underneath it.
 */
export function DateStrip({ chips, allHref, activeDay, today }: Props) {
  const railRef = useRef<HTMLDivElement>(null);
  const allRef = useRef<HTMLAnchorElement>(null);
  const chipRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  // With nothing selected, the strip opens on today (or the next day with a
  // match, once the season has moved past every day that still has one).
  const defaultChip = chips.find((chip) => chip.key >= today) ?? chips.at(-1);

  useEffect(() => {
    const rail = railRef.current;
    const all = allRef.current;
    if (!rail || !all) return;

    const targetKey = activeDay ?? defaultChip?.key;
    const target = targetKey ? chipRefs.current.get(targetKey) : undefined;
    if (!target) {
      rail.scrollLeft = 0;
      return;
    }

    rail.scrollLeft = activeDay
      ? // A picked day gets centered, so it reads comfortably mid-strip.
        target.offsetLeft - rail.clientWidth / 2 + target.clientWidth / 2
      : // Otherwise open right on the default chip, just past "All".
        target.offsetLeft - all.clientWidth - GAP_PX;
  }, [activeDay, defaultChip?.key]);

  return (
    <div ref={railRef} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="sticky left-0 z-10 shrink-0 bg-navy">
        <Link
          ref={allRef}
          href={allHref}
          className={`flex flex-col items-center justify-center rounded-xl px-4 py-2 text-center transition ${
            activeDay === null
              ? "bg-accent text-white"
              : "bg-white/10 text-white/70 hover:bg-white/16 hover:text-white"
          }`}
        >
          <span className="text-[13px] font-bold">All</span>
          <span className="text-[11px] opacity-70">Season</span>
        </Link>
      </div>

      {chips.map((chip) => {
        const active = chip.key === activeDay;
        return (
          <Link
            key={chip.key}
            href={chip.href}
            ref={(el) => {
              if (el) chipRefs.current.set(chip.key, el);
              else chipRefs.current.delete(chip.key);
            }}
            aria-current={active ? "date" : undefined}
            className={`flex shrink-0 flex-col items-center justify-center rounded-xl px-4 py-2 text-center transition ${
              active
                ? "bg-accent text-white"
                : chip.isToday
                  ? "bg-white/16 text-white hover:bg-white/24"
                  : "bg-white/10 text-white/70 hover:bg-white/16 hover:text-white"
            }`}
          >
            <span className="text-[13px] font-bold whitespace-nowrap">{chip.top}</span>
            <span className="text-[11px] whitespace-nowrap opacity-70">{chip.bottom}</span>
          </Link>
        );
      })}
    </div>
  );
}
