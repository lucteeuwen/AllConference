"use client";

import type { ReactNode } from "react";

/**
 * Seamless marquee. The track holds the children twice, so translating it -50%
 * lands exactly where it began.
 */
export function ScoreTicker({ children, seconds = 42 }: { children: ReactNode; seconds?: number }) {
  return (
    <div className="relative overflow-hidden" aria-hidden="true">
      <div
        className="marquee-track flex w-max"
        style={{ "--marquee-duration": `${seconds}s` } as React.CSSProperties}
      >
        <div className="flex shrink-0">{children}</div>
        <div className="flex shrink-0">{children}</div>
      </div>
    </div>
  );
}
