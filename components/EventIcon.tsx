import type { MatchEvent } from "@/lib/types";

export type EventIconType = MatchEvent["type"] | "assist";

/** The small marks for the plays that are not goals or cards: drawn, 16 units square, in the page's muted ink. */
function PlayIcon({ type }: { type: "sub" | "shot" | "foul" | "corner" | "freekick" | "period" }) {
  const common = {
    viewBox: "0 0 16 16",
    className: "size-3.5 shrink-0 text-ink-muted",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (type) {
    case "sub":
      // One arrow up for the player on, one down for the player off.
      return (
        <svg {...common}>
          <path d="M5 13V3M2.5 5.5L5 3l2.5 2.5" />
          <path d="M11 3v10M8.5 10.5L11 13l2.5-2.5" />
        </svg>
      );
    case "shot":
      // A target.
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.2" />
          <circle cx="8" cy="8" r="2.6" />
        </svg>
      );
    case "foul":
      // A whistle.
      return (
        <svg {...common}>
          <circle cx="10" cy="9.5" r="3.3" />
          <path d="M6.8 7.2H1.8v3h3.4M10 6.2V3.2" />
        </svg>
      );
    case "corner":
      // The corner flag.
      return (
        <svg {...common}>
          <path d="M4 14V2.5M4 2.5l7 2.6-7 2.6" />
        </svg>
      );
    case "freekick":
      // The wall: three short strokes.
      return (
        <svg {...common}>
          <path d="M3.5 4v8M8 4v8M12.5 4v8" />
        </svg>
      );
    case "period":
      // A clock.
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.2" />
          <path d="M8 4.5V8l2.4 1.6" />
        </svg>
      );
  }
}

/**
 * A goal, an assist, a card or another play on the timeline. Drawn rather than
 * set in emoji: emoji depend on a font the machine may not have, and these need
 * to read the same everywhere.
 */
export function EventIcon({ type }: { type: EventIconType }) {
  if (type === "sub" || type === "shot" || type === "foul" || type === "corner" || type === "freekick" || type === "period") {
    return <PlayIcon type={type} />;
  }
  if (type === "yellow" || type === "red") {
    return (
      <span
        aria-hidden="true"
        className="block h-3.5 w-2.5 shrink-0 rounded-[2px]"
        style={{ background: type === "yellow" ? "#eab308" : "var(--loss)" }}
      />
    );
  }
  if (type === "assist") {
    return (
      <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-ink-muted" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <text x="8" y="11.2" textAnchor="middle" fontSize="9" fontWeight="700" fill="currentColor">
          A
        </text>
      </svg>
    );
  }
  // A football: white ball with dark patches (fixed colours, so it reads on light and dark pages), a centre pentagon, seams out to the edge patches.
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5 shrink-0"
      style={{ color: type === "own-goal" ? "var(--loss)" : "#18181b" }}
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="7.2" fill="#fff" stroke="currentColor" strokeWidth="1" />
      <path d="M8 5.1l2.7 2-1 3.1H6.3l-1-3.1z" fill="currentColor" />
      <path
        d="M8 5.1V1M10.7 7.1l3.9-1.2M9.7 10.2l2.4 3.3M6.3 10.2l-2.4 3.3M5.3 7.1L1.4 5.9"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M5.5 2.2L8 1l2.5 1.2L8 3.6zM13.6 5.2l.9 2.6-1.8.6-.8-2.3zM2.4 5.2l-.9 2.6 1.8.6.8-2.3z" fill="currentColor" />
    </svg>
  );
}
