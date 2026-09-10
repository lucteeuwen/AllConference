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
};

/**
 * Horizontal date rail. Labels arrive already formatted from the server so the
 * markup matches on hydration; the only client-side work is scrolling the
 * selected chip into view on mount.
 */
export function DateStrip({ chips, allHref, activeDay }: Props) {
  const railRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const rail = railRef.current;
    const chip = activeRef.current;
    if (!rail || !chip) return;
    rail.scrollLeft = chip.offsetLeft - rail.clientWidth / 2 + chip.clientWidth / 2;
  }, [activeDay]);

  return (
    <div ref={railRef} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
      <Link
        href={allHref}
        className={`flex shrink-0 flex-col items-center justify-center rounded-xl px-4 py-2 text-center transition ${
          activeDay === null
            ? "bg-accent text-white"
            : "bg-white/10 text-white/70 hover:bg-white/16 hover:text-white"
        }`}
      >
        <span className="text-[13px] font-bold">All</span>
        <span className="text-[11px] opacity-70">Season</span>
      </Link>

      {chips.map((chip) => {
        const active = chip.key === activeDay;
        return (
          <Link
            key={chip.key}
            href={chip.href}
            ref={active ? activeRef : undefined}
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
