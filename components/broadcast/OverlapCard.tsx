import type { ReactNode } from "react";

/**
 * The surface card that laps over the bottom edge of a hero, lifted from the
 * reference video's boxscore panel. Negative top margin does the overlap; the
 * side padding keeps it inset from the hero's corners.
 */
export function OverlapCard({ children }: { children: ReactNode }) {
  return (
    <div className="-mt-5 px-3 md:px-8">
      <div className="bc-card bc-pad bc-shadow">{children}</div>
    </div>
  );
}
