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
 * scroll on mount. "All" stays pinned to the left while the day chips scroll
 * underneath it: on phones its backing runs out to the screen edge (sticky
 * offsets are measured from the rail's padding, hence `-left-4`) so the button
 * keeps its inset, and it fades into the chips beside it.
 */
export function DateStrip({ chips, allHref, activeDay, today }: Props) {
  const railRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  // With nothing selected, the strip opens on today (or the next day with a
  // match, once the season has moved past every day that still has one).
  const defaultChip = chips.find((chip) => chip.key >= today) ?? chips.at(-1);

  useEffect(() => {
    const rail = railRef.current;
    const pinned = pinnedRef.current;
    if (!rail || !pinned) return;

    const targetKey = activeDay ?? defaultChip?.key;
    const target = targetKey ? chipRefs.current.get(targetKey) : undefined;
    if (!target) {
      rail.scrollLeft = 0;
      return;
    }

    const railBox = rail.getBoundingClientRect();
    const targetBox = target.getBoundingClientRect();
    rail.scrollLeft += activeDay
      ? // A picked day gets centered, so it reads comfortably mid-strip.
        targetBox.left + targetBox.width / 2 - (railBox.left + railBox.width / 2)
      : // Otherwise open right on the default chip, just past the pinned "All".
        targetBox.left - (railBox.left + pinned.offsetWidth + GAP_PX);
  }, [activeDay, defaultChip?.key]);

  return (
    <div ref={railRef} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div
        ref={pinnedRef}
        className="sticky -left-4 z-10 -ml-4 shrink-0 bg-navy pr-2 pl-4 after:pointer-events-none after:absolute after:top-0 after:left-full after:h-full after:w-3 after:bg-linear-to-r after:from-navy after:to-transparent md:left-0 md:ml-0 md:pl-0"
      >
        <Link
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
