import type { MatchEvent } from "@/lib/types";

/**
 * A goal or a card. Drawn rather than set in emoji: emoji depend on a font
 * the machine may not have, and these need to read the same everywhere.
 */
export function EventIcon({ type }: { type: MatchEvent["type"] }) {
  if (type === "yellow" || type === "red") {
    return (
      <span
        aria-hidden="true"
        className="block h-3.5 w-2.5 shrink-0 rounded-[2px]"
        style={{ background: type === "yellow" ? "#eab308" : "var(--loss)" }}
      />
    );
  }
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-ink" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 3.4l3 2.2-1.15 3.55h-3.7L5 5.6z" fill="currentColor" />
    </svg>
  );
}
